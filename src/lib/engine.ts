import {
  Allocation,
  CourseSection,
  DayOfWeek,
  FlexibleSlotOption,
  Room,
  RoomConflictResult,
  SlotRecommendation,
  SlotSafetyStatus,
  Student,
  StudentClashDetail,
  StudentConflictResult,
  TimeInterval,
  TimeSlot,
} from '../types/timetable';
import { CAMPUS_DAY_END_MINUTES, CAMPUS_DAY_START_MINUTES, DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from './constants';
import { getAllocationInterval, isTimeOverlap, minutesToTimeString } from './utils';

/**
 * Checks if a target room is occupied during the requested day and time interval.
 * @param targetDay Target day of the week
 * @param targetInterval Target time window { startMinutes, endMinutes }
 * @param targetRoomId Target room ID
 * @param allocations All current timetable allocations
 * @param courses Map or array of course sections for metadata
 * @param excludeAllocationId Optional allocation ID to ignore (e.g. the one being moved)
 */
export function checkRoomConflict(
  targetDay: DayOfWeek,
  targetInterval: { startMinutes: number; endMinutes: number },
  targetRoomId: string,
  allocations: Allocation[],
  courses: CourseSection[] | Map<string, CourseSection>,
  excludeAllocationId?: string
): RoomConflictResult {
  const courseMap = courses instanceof Map
    ? courses
    : new Map(courses.map(c => [c.id, c]));

  const conflictingAlloc = allocations.find(alloc => {
    if (excludeAllocationId && alloc.id === excludeAllocationId) {
      return false;
    }
    if (alloc.day !== targetDay || alloc.roomId !== targetRoomId) {
      return false;
    }
    const allocInterval = getAllocationInterval(alloc.slotId, alloc.customInterval);
    return isTimeOverlap(
      targetInterval.startMinutes,
      targetInterval.endMinutes,
      allocInterval.startMinutes,
      allocInterval.endMinutes
    );
  });

  if (!conflictingAlloc) {
    return { hasConflict: false };
  }

  const course = courseMap.get(conflictingAlloc.courseSectionId);
  return {
    hasConflict: true,
    conflictingAllocation: conflictingAlloc,
    conflictingCourse: course,
    reason: `Room is already occupied by ${course ? `${course.courseCode} (${course.section})` : conflictingAlloc.courseSectionId}`,
  };
}

/**
 * Checks student clashes when scheduling a course section into a specific day and time slot.
 * 1. Retrieves all students enrolled in `courseSectionId`.
 * 2. Finds all other allocations scheduled during the target time window on `targetDay`.
 * 3. Identifies which enrolled students are also enrolled in any overlapping course section.
 */
export function checkStudentClashes(
  courseSectionId: string,
  targetDay: DayOfWeek,
  targetInterval: { startMinutes: number; endMinutes: number },
  allocations: Allocation[],
  students: Student[],
  courses: CourseSection[] | Map<string, CourseSection>,
  rooms: Room[] | Map<string, Room>,
  excludeAllocationId?: string
): StudentConflictResult {
  const courseMap = courses instanceof Map
    ? courses
    : new Map(courses.map(c => [c.id, c]));

  const roomMap = rooms instanceof Map
    ? rooms
    : new Map(rooms.map(r => [r.id, r]));

  // 1. Students enrolled in the selected course
  const enrolledStudents = students.filter(s =>
    s.enrolledSectionIds.includes(courseSectionId)
  );
  const totalEnrolled = enrolledStudents.length;

  if (totalEnrolled === 0) {
    return {
      clashCount: 0,
      clashStudents: [],
      totalEnrolled: 0,
      clashPercentage: 0,
      severity: 'SAFE',
    };
  }

  // 2. Find concurrent allocations on the same day during overlapping time
  const concurrentAllocations = allocations.filter(alloc => {
    if (excludeAllocationId && alloc.id === excludeAllocationId) {
      return false;
    }
    if (alloc.day !== targetDay) {
      return false;
    }
    // Cannot clash with another session of the exact same course section if it's the one being moved,
    // but if it's a different session of the same course section, it should be treated as concurrent
    if (alloc.courseSectionId === courseSectionId && alloc.id === excludeAllocationId) {
      return false;
    }

    const allocInterval = getAllocationInterval(alloc.slotId, alloc.customInterval);
    return isTimeOverlap(
      targetInterval.startMinutes,
      targetInterval.endMinutes,
      allocInterval.startMinutes,
      allocInterval.endMinutes
    );
  });

  if (concurrentAllocations.length === 0) {
    return {
      clashCount: 0,
      clashStudents: [],
      totalEnrolled,
      clashPercentage: 0,
      severity: 'SAFE',
    };
  }

  // Build a lookup of concurrent course section IDs to their allocation & room
  const concurrentCourseLookup = new Map<string, { alloc: Allocation; course?: CourseSection; room?: Room }>();
  for (const alloc of concurrentAllocations) {
    concurrentCourseLookup.set(alloc.courseSectionId, {
      alloc,
      course: courseMap.get(alloc.courseSectionId),
      room: roomMap.get(alloc.roomId),
    });
  }

  // 3. For each student in the target course, check if enrolled in any concurrent course
  const clashDetails: StudentClashDetail[] = [];
  const uniqueClashingStudents = new Set<string>();

  for (const student of enrolledStudents) {
    for (const enrolledCourseId of student.enrolledSectionIds) {
      // Don't clash with the course itself
      if (enrolledCourseId === courseSectionId) continue;

      const concurrentMatch = concurrentCourseLookup.get(enrolledCourseId);
      if (concurrentMatch) {
        uniqueClashingStudents.add(student.id);
        const standardSlot = STANDARD_TIME_SLOTS.find(s => s.id === concurrentMatch.alloc.slotId);
        const timeLabel = standardSlot
          ? standardSlot.label
          : `${concurrentMatch.alloc.customInterval?.startTime} - ${concurrentMatch.alloc.customInterval?.endTime}`;

        clashDetails.push({
          studentId: student.id,
          studentName: student.name,
          conflictingAllocationId: concurrentMatch.alloc.id,
          conflictingCourseCode: concurrentMatch.course?.courseCode || enrolledCourseId,
          conflictingCourseTitle: concurrentMatch.course?.courseTitle || 'Unknown Course',
          conflictingSection: concurrentMatch.course?.section || '',
          conflictingRoomId: concurrentMatch.alloc.roomId,
          conflictingRoomName: concurrentMatch.room?.name || concurrentMatch.alloc.roomId,
          day: targetDay,
          timeSlotLabel: timeLabel,
        });
      }
    }
  }

  const clashCount = uniqueClashingStudents.size;
  const clashPercentage = totalEnrolled > 0 ? Math.round((clashCount / totalEnrolled) * 100) : 0;

  let severity: 'SAFE' | 'MINOR' | 'CRITICAL' = 'SAFE';
  if (clashCount > 0) {
    // If 1-3 students clash, it's Minor; more than 3 is Critical
    severity = clashCount <= 3 ? 'MINOR' : 'CRITICAL';
  }

  return {
    clashCount,
    clashStudents: clashDetails,
    totalEnrolled,
    clashPercentage,
    severity,
  };
}

/**
 * Computes slot recommendations across all 6 days and 6 standard slots for a given room.
 */
export function getSlotRecommendationsForRoom(
  courseSectionId: string,
  targetRoomId: string,
  allocations: Allocation[],
  students: Student[],
  courses: CourseSection[],
  rooms: Room[],
  excludeAllocationId?: string
): SlotRecommendation[] {
  const targetRoom = rooms.find(r => r.id === targetRoomId);
  const roomName = targetRoom ? targetRoom.name : targetRoomId;
  const roomCapacity = targetRoom?.capacity || 40;
  const roomType = targetRoom?.type || 'Lecture';

  const recommendations: SlotRecommendation[] = [];

  for (const day of DAYS_OF_WEEK) {
    for (const slot of STANDARD_TIME_SLOTS) {
      const targetInterval = {
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      };

      const roomConflict = checkRoomConflict(
        day,
        targetInterval,
        targetRoomId,
        allocations,
        courses,
        excludeAllocationId
      );

      const studentClashes = checkStudentClashes(
        courseSectionId,
        day,
        targetInterval,
        allocations,
        students,
        courses,
        rooms,
        excludeAllocationId
      );

      let status: SlotSafetyStatus = 'SAFE';
      let statusLabel = 'Safe (0 Clashes)';
      let score = 100;

      if (roomConflict.hasConflict) {
        status = 'BLOCKED';
        statusLabel = `Blocked (Room occupied by ${roomConflict.conflictingCourse?.courseCode || 'another class'})`;
        score = 0;
      } else if (studentClashes.clashCount > 3) {
        status = 'BLOCKED';
        statusLabel = `High Conflict (${studentClashes.clashCount} student clashes - ${studentClashes.clashPercentage}%)`;
        score = Math.max(10, 50 - studentClashes.clashCount * 10);
      } else if (studentClashes.clashCount > 0) {
        status = 'MINOR_CLASH';
        statusLabel = `Minor Clash (${studentClashes.clashCount} student${studentClashes.clashCount > 1 ? 's' : ''} affected)`;
        score = 80 - studentClashes.clashCount * 10;
      }

      recommendations.push({
        day,
        slot,
        roomId: targetRoomId,
        roomName,
        roomCapacity,
        roomType,
        isRoomFree: !roomConflict.hasConflict,
        roomConflict: roomConflict.hasConflict ? roomConflict : undefined,
        studentClashes,
        status,
        statusLabel,
        score,
      });
    }
  }

  return recommendations;
}

/**
 * Finds all rooms with Safe (0 clash) or Minor clash recommendations across the week.
 */
export function getBestSlotsAcrossAllRooms(
  courseSectionId: string,
  allocations: Allocation[],
  students: Student[],
  courses: CourseSection[],
  rooms: Room[],
  excludeAllocationId?: string,
  filterDay?: DayOfWeek
): SlotRecommendation[] {
  const allRecommendations: SlotRecommendation[] = [];

  const daysToScan = filterDay ? [filterDay] : DAYS_OF_WEEK;

  for (const room of rooms) {
    for (const day of daysToScan) {
      for (const slot of STANDARD_TIME_SLOTS) {
        const targetInterval = {
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
        };

        const roomConflict = checkRoomConflict(
          day,
          targetInterval,
          room.id,
          allocations,
          courses,
          excludeAllocationId
        );

        // Skip occupied rooms when finding best slots across all rooms
        if (roomConflict.hasConflict) continue;

        const studentClashes = checkStudentClashes(
          courseSectionId,
          day,
          targetInterval,
          allocations,
          students,
          courses,
          rooms,
          excludeAllocationId
        );

        let status: SlotSafetyStatus = 'SAFE';
        let statusLabel = 'Safe (0 Clashes)';
        let score = 100;

        if (studentClashes.clashCount > 3) {
          status = 'BLOCKED';
          statusLabel = `High Conflict (${studentClashes.clashCount} clashes)`;
          score = 30;
        } else if (studentClashes.clashCount > 0) {
          status = 'MINOR_CLASH';
          statusLabel = `Minor Clash (${studentClashes.clashCount} clash${studentClashes.clashCount > 1 ? 'es' : ''})`;
          score = 85 - studentClashes.clashCount * 10;
        }

        allRecommendations.push({
          day,
          slot,
          roomId: room.id,
          roomName: room.name,
          roomCapacity: room.capacity,
          roomType: room.type,
          isRoomFree: true,
          studentClashes,
          status,
          statusLabel,
          score,
        });
      }
    }
  }

  // Sort best options first: SAFE first, then fewest clashes, then higher capacity
  return allRecommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.studentClashes.clashCount - b.studentClashes.clashCount;
  });
}

/**
 * Flexible / Extra Slot Allocator:
 * Scans available room free windows for custom durations (e.g. 60m, 120m)
 * and calculates clashes for each prospective slot.
 */
export function findFlexibleSlots(
  courseSectionId: string,
  durationMinutes: number, // e.g. 60 or 120
  allocations: Allocation[],
  students: Student[],
  courses: CourseSection[],
  rooms: Room[],
  preferredDays?: DayOfWeek[],
  roomTypeFilter?: string
): FlexibleSlotOption[] {
  const daysToScan = preferredDays && preferredDays.length > 0 ? preferredDays : DAYS_OF_WEEK;
  const filteredRooms = roomTypeFilter
    ? rooms.filter(r => r.type.toLowerCase() === roomTypeFilter.toLowerCase())
    : rooms;

  const results: FlexibleSlotOption[] = [];
  const STEP_MINUTES = 30; // Scan in 30 min increments (e.g. 08:30, 09:00, ...)

  for (const day of daysToScan) {
    for (const room of filteredRooms) {
      // Collect all occupied intervals for this room on this day
      const occupiedIntervals = allocations
        .filter(a => a.day === day && a.roomId === room.id)
        .map(a => getAllocationInterval(a.slotId, a.customInterval))
        .sort((a, b) => a.startMinutes - b.startMinutes);

      // Search continuous free slots from CAMPUS_DAY_START_MINUTES to CAMPUS_DAY_END_MINUTES
      for (
        let start = CAMPUS_DAY_START_MINUTES;
        start + durationMinutes <= CAMPUS_DAY_END_MINUTES;
        start += STEP_MINUTES
      ) {
        const end = start + durationMinutes;

        // Check if [start, end) conflicts with any occupied interval
        const hasRoomConflict = occupiedIntervals.some(occ =>
          isTimeOverlap(start, end, occ.startMinutes, occ.endMinutes)
        );

        if (!hasRoomConflict) {
          const studentClashes = checkStudentClashes(
            courseSectionId,
            day,
            { startMinutes: start, endMinutes: end },
            allocations,
            students,
            courses,
            rooms
          );

          let status: SlotSafetyStatus = 'SAFE';
          if (studentClashes.clashCount > 3) {
            status = 'BLOCKED';
          } else if (studentClashes.clashCount > 0) {
            status = 'MINOR_CLASH';
          }

          results.push({
            day,
            roomId: room.id,
            roomName: room.name,
            roomType: room.type,
            capacity: room.capacity,
            startTime: minutesToTimeString(start),
            endTime: minutesToTimeString(end),
            startMinutes: start,
            endMinutes: end,
            durationMinutes,
            studentClashes,
            status,
          });
        }
      }
    }
  }

  // Sort: SAFE first, then lowest clash count, then day order
  return results.sort((a, b) => {
    if (a.status === 'SAFE' && b.status !== 'SAFE') return -1;
    if (a.status !== 'SAFE' && b.status === 'SAFE') return 1;
    if (a.studentClashes.clashCount !== b.studentClashes.clashCount) {
      return a.studentClashes.clashCount - b.studentClashes.clashCount;
    }
    return DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day);
  });
}

export interface VacantRoomResult {
  room: Room;
  isVacant: boolean;
  occupyingAllocation?: Allocation;
  occupyingCourse?: CourseSection;
  studentClashCount: number;
  clashStatus: SlotSafetyStatus;
  reason?: string;
}

/**
 * Evaluates all campus rooms for vacancy during a target day and time window,
 * cross-checking student clashes for a specific course section if provided.
 */
export function getVacantRooms(
  targetDay: DayOfWeek,
  targetInterval: { startMinutes: number; endMinutes: number },
  allocations: Allocation[],
  rooms: Room[],
  courses: CourseSection[] | Map<string, CourseSection>,
  students: Student[],
  courseSectionId?: string,
  excludeAllocationId?: string
): VacantRoomResult[] {
  return rooms.map(room => {
    // 1. Check room occupancy
    const roomConflict = checkRoomConflict(
      targetDay,
      targetInterval,
      room.id,
      allocations,
      courses,
      excludeAllocationId
    );

    if (roomConflict.hasConflict) {
      return {
        room,
        isVacant: false,
        occupyingAllocation: roomConflict.conflictingAllocation,
        occupyingCourse: roomConflict.conflictingCourse,
        studentClashCount: 0,
        clashStatus: 'BLOCKED' as SlotSafetyStatus,
        reason: roomConflict.reason || 'Room is occupied',
      };
    }

    // 2. Room is vacant! If courseSectionId provided, check student clashes for this time
    let studentClashCount = 0;
    let clashStatus: SlotSafetyStatus = 'SAFE';
    let reason = 'Room is 100% vacant';

    if (courseSectionId) {
      const studentClashes = checkStudentClashes(
        courseSectionId,
        targetDay,
        targetInterval,
        allocations,
        students,
        courses,
        rooms,
        excludeAllocationId
      );
      studentClashCount = studentClashes.clashCount;
      if (studentClashes.clashCount > 3) {
        clashStatus = 'BLOCKED';
        reason = `Vacant, but ${studentClashes.clashCount} enrolled students clash`;
      } else if (studentClashes.clashCount > 0) {
        clashStatus = 'MINOR_CLASH';
        reason = `Vacant, with ${studentClashes.clashCount} minor student clash(es)`;
      } else {
        clashStatus = 'SAFE';
        reason = 'Vacant with 0 student clashes';
      }
    }

    return {
      room,
      isVacant: true,
      studentClashCount,
      clashStatus,
      reason,
    };
  }).sort((a, b) => {
    // Vacant rooms first
    if (a.isVacant && !b.isVacant) return -1;
    if (!a.isVacant && b.isVacant) return 1;
    // Then SAFE first
    if (a.clashStatus === 'SAFE' && b.clashStatus !== 'SAFE') return -1;
    if (a.clashStatus !== 'SAFE' && b.clashStatus === 'SAFE') return 1;
    // Then capacity descending
    return b.room.capacity - a.room.capacity;
  });
}

