import {
  Allocation,
  CapacityCheckResult,
  CourseSection,
  DayOfWeek,
  FlexibleSlotOption,
  InstructorConflictResult,
  Room,
  RoomConflictResult,
  SlotRecommendation,
  SlotSafetyStatus,
  Student,
  StudentClashDetail,
  StudentConflictResult,
  TimeSlot,
} from '../types/timetable';
import { CAMPUS_DAY_END_MINUTES, CAMPUS_DAY_START_MINUTES, DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from './constants';
import { getAllocationInterval, isTimeOverlap, minutesToTimeString } from './utils';

type Interval = { startMinutes: number; endMinutes: number };
type TimedAllocation = { alloc: Allocation; startMinutes: number; endMinutes: number };

/**
 * Lookup indexes, cached per array reference. The store replaces arrays on every change
 * (never mutates them), so a WeakMap keyed by the array is a safe memo.
 */
const courseMapCache = new WeakMap<CourseSection[], Map<string, CourseSection>>();
const roomMapCache = new WeakMap<Room[], Map<string, Room>>();
const sectionRosterCache = new WeakMap<Student[], Map<string, Student[]>>();
const allocationsByDayCache = new WeakMap<Allocation[], Map<DayOfWeek, TimedAllocation[]>>();

export function getCourseMap(courses: CourseSection[] | Map<string, CourseSection>): Map<string, CourseSection> {
  if (courses instanceof Map) return courses;
  let map = courseMapCache.get(courses);
  if (!map) {
    map = new Map(courses.map(c => [c.id, c]));
    courseMapCache.set(courses, map);
  }
  return map;
}

export function getRoomMap(rooms: Room[] | Map<string, Room>): Map<string, Room> {
  if (rooms instanceof Map) return rooms;
  let map = roomMapCache.get(rooms);
  if (!map) {
    map = new Map(rooms.map(r => [r.id, r]));
    roomMapCache.set(rooms, map);
  }
  return map;
}

/** Section ID -> students enrolled in it. */
export function getSectionRoster(students: Student[]): Map<string, Student[]> {
  let map = sectionRosterCache.get(students);
  if (!map) {
    map = new Map();
    for (const student of students) {
      for (const sectionId of student.enrolledSectionIds) {
        const list = map.get(sectionId);
        if (list) list.push(student);
        else map.set(sectionId, [student]);
      }
    }
    sectionRosterCache.set(students, map);
  }
  return map;
}

export function getEnrolledCount(sectionId: string, students: Student[]): number {
  return getSectionRoster(students).get(sectionId)?.length || 0;
}

function getAllocationsByDay(allocations: Allocation[]): Map<DayOfWeek, TimedAllocation[]> {
  let map = allocationsByDayCache.get(allocations);
  if (!map) {
    map = new Map();
    for (const alloc of allocations) {
      const interval = getAllocationInterval(alloc.slotId, alloc.customInterval);
      const entry = { alloc, startMinutes: interval.startMinutes, endMinutes: interval.endMinutes };
      const list = map.get(alloc.day);
      if (list) list.push(entry);
      else map.set(alloc.day, [entry]);
    }
    allocationsByDayCache.set(allocations, map);
  }
  return map;
}

function getOverlappingAllocations(
  allocations: Allocation[],
  day: DayOfWeek,
  interval: Interval,
  excludeAllocationId?: string
): Allocation[] {
  const dayAllocations = getAllocationsByDay(allocations).get(day) || [];
  const result: Allocation[] = [];
  for (const entry of dayAllocations) {
    if (excludeAllocationId && entry.alloc.id === excludeAllocationId) continue;
    if (isTimeOverlap(interval.startMinutes, interval.endMinutes, entry.startMinutes, entry.endMinutes)) {
      result.push(entry.alloc);
    }
  }
  return result;
}

function formatAllocationTime(alloc: Allocation): string {
  const standardSlot = STANDARD_TIME_SLOTS.find(s => s.id === alloc.slotId);
  return standardSlot
    ? standardSlot.label
    : `${alloc.customInterval?.startTime} - ${alloc.customInterval?.endTime}`;
}

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
  targetInterval: Interval,
  targetRoomId: string,
  allocations: Allocation[],
  courses: CourseSection[] | Map<string, CourseSection>,
  excludeAllocationId?: string
): RoomConflictResult {
  const conflictingAlloc = getOverlappingAllocations(allocations, targetDay, targetInterval, excludeAllocationId)
    .find(alloc => alloc.roomId === targetRoomId);

  if (!conflictingAlloc) {
    return { hasConflict: false };
  }

  const course = getCourseMap(courses).get(conflictingAlloc.courseSectionId);
  return {
    hasConflict: true,
    conflictingAllocation: conflictingAlloc,
    conflictingCourse: course,
    reason: course
      ? `Room is already occupied by ${course.courseCode} (${course.section})`
      : `Room is reserved: ${conflictingAlloc.note || conflictingAlloc.courseSectionId}`,
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
  targetInterval: Interval,
  allocations: Allocation[],
  students: Student[],
  courses: CourseSection[] | Map<string, CourseSection>,
  rooms: Room[] | Map<string, Room>,
  excludeAllocationId?: string
): StudentConflictResult {
  // 1. Students enrolled in the selected course
  const enrolledStudents = getSectionRoster(students).get(courseSectionId) || [];
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
  const concurrentAllocations = getOverlappingAllocations(allocations, targetDay, targetInterval, excludeAllocationId);

  if (concurrentAllocations.length === 0) {
    return {
      clashCount: 0,
      clashStudents: [],
      totalEnrolled,
      clashPercentage: 0,
      severity: 'SAFE',
    };
  }

  const courseMap = getCourseMap(courses);
  const roomMap = getRoomMap(rooms);

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
          timeSlotLabel: formatAllocationTime(concurrentMatch.alloc),
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

// Placeholder instructor names that must never be treated as a real person
const PLACEHOLDER_INSTRUCTORS = new Set([
  '',
  'no teacher assigned',
  'fast faculty',
  'faculty',
  'tba',
  'tbd',
  'n/a',
  'na',
  '#n/a',
  'visiting faculty',
]);

/** Splits co-taught instructor strings ("A, B" / "A & B") into normalized names, dropping placeholders. */
export function getInstructorNames(instructor: string | undefined): string[] {
  if (!instructor) return [];
  return instructor
    .split(/[,;&/]| and /i)
    .map(name => name.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(name => !PLACEHOLDER_INSTRUCTORS.has(name));
}

/**
 * Checks whether the instructor(s) of `courseSectionId` already teach another class
 * during the target window on `targetDay`.
 */
export function checkInstructorConflict(
  courseSectionId: string,
  targetDay: DayOfWeek,
  targetInterval: Interval,
  allocations: Allocation[],
  courses: CourseSection[] | Map<string, CourseSection>,
  rooms: Room[] | Map<string, Room>,
  excludeAllocationId?: string
): InstructorConflictResult {
  const courseMap = getCourseMap(courses);
  const instructors = getInstructorNames(courseMap.get(courseSectionId)?.instructor);
  if (instructors.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  const roomMap = getRoomMap(rooms);
  const conflicts: InstructorConflictResult['conflicts'] = [];

  for (const alloc of getOverlappingAllocations(allocations, targetDay, targetInterval, excludeAllocationId)) {
    const otherCourse = courseMap.get(alloc.courseSectionId);
    const otherInstructors = getInstructorNames(otherCourse?.instructor);
    const shared = instructors.find(name => otherInstructors.includes(name));
    if (!shared || !otherCourse) continue;

    conflicts.push({
      instructor: otherCourse.instructor,
      allocation: alloc,
      course: otherCourse,
      roomName: roomMap.get(alloc.roomId)?.name || alloc.roomId,
      timeLabel: formatAllocationTime(alloc),
    });
  }

  if (conflicts.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  const first = conflicts[0];
  return {
    hasConflict: true,
    conflicts,
    reason: `${first.course.instructor} is already teaching ${first.course.courseCode} (${first.course.section}) in ${first.roomName}`,
  };
}

export function isLabCourse(course: CourseSection | undefined): boolean {
  return !!course && /\blab\b/i.test(course.courseTitle);
}

/**
 * Checks whether a room is suitable for the section: enough seats, and lab sections in labs.
 * These are warnings, not hard blocks, because room capacities are often approximate.
 */
export function checkRoomSuitability(
  course: CourseSection | undefined,
  room: Room | undefined,
  enrolledCount: number
): CapacityCheckResult {
  const warnings: string[] = [];
  const capacity = room?.capacity || 0;
  const overCapacity = !!room && capacity > 0 && enrolledCount > capacity;

  if (overCapacity) {
    warnings.push(`${enrolledCount} students enrolled but ${room!.name} seats only ${capacity}`);
  }

  let roomTypeMismatch = false;
  if (course && room) {
    const isLab = isLabCourse(course);
    if (isLab && room.type !== 'Lab') {
      roomTypeMismatch = true;
      warnings.push(`Lab section placed in a non-lab room (${room.type})`);
    } else if (!isLab && room.type === 'Lab') {
      roomTypeMismatch = true;
      warnings.push('Theory section placed in a lab room');
    }
  }

  return { overCapacity, roomTypeMismatch, enrolledCount, capacity, warnings };
}

interface SlotEvaluation {
  status: SlotSafetyStatus;
  statusLabel: string;
  score: number;
}

/** Shared status/score rules for standard-slot recommendations. */
function evaluateSlot(
  roomConflict: RoomConflictResult,
  instructorConflict: InstructorConflictResult,
  studentClashes: StudentConflictResult,
  suitability: CapacityCheckResult
): SlotEvaluation {
  if (roomConflict.hasConflict) {
    return {
      status: 'BLOCKED',
      statusLabel: `Blocked (Room ${roomConflict.conflictingCourse ? `occupied by ${roomConflict.conflictingCourse.courseCode}` : `reserved: ${roomConflict.conflictingAllocation?.note || 'another class'}`})`,
      score: 0,
    };
  }
  if (instructorConflict.hasConflict) {
    const other = instructorConflict.conflicts[0].course;
    return {
      status: 'BLOCKED',
      statusLabel: `Blocked (Instructor teaching ${other.courseCode} ${other.section})`,
      score: 5,
    };
  }

  // Unsuitable rooms stay bookable but rank below suitable ones
  const suitabilityPenalty = (suitability.overCapacity ? 15 : 0) + (suitability.roomTypeMismatch ? 10 : 0);

  if (studentClashes.clashCount > 3) {
    return {
      status: 'BLOCKED',
      statusLabel: `High Conflict (${studentClashes.clashCount} student clashes - ${studentClashes.clashPercentage}%)`,
      score: Math.max(10, 50 - studentClashes.clashCount * 10) - Math.min(suitabilityPenalty, 9),
    };
  }
  if (studentClashes.clashCount > 0) {
    return {
      status: 'MINOR_CLASH',
      statusLabel: `Minor Clash (${studentClashes.clashCount} student${studentClashes.clashCount > 1 ? 's' : ''} affected)`,
      score: 80 - studentClashes.clashCount * 10 - suitabilityPenalty,
    };
  }
  return {
    status: 'SAFE',
    statusLabel: suitability.warnings.length > 0 ? `Safe (0 Clashes) – ${suitability.warnings[0]}` : 'Safe (0 Clashes)',
    score: 100 - suitabilityPenalty,
  };
}

/**
 * Student and instructor clashes depend only on (day, time), not on the room,
 * so they are computed once per window and shared across every room.
 */
function createWindowEvaluator(
  courseSectionId: string,
  allocations: Allocation[],
  students: Student[],
  courses: CourseSection[],
  rooms: Room[],
  excludeAllocationId?: string
) {
  const cache = new Map<string, { studentClashes: StudentConflictResult; instructorConflict: InstructorConflictResult }>();
  return (day: DayOfWeek, interval: Interval) => {
    const key = `${day}|${interval.startMinutes}|${interval.endMinutes}`;
    let result = cache.get(key);
    if (!result) {
      result = {
        studentClashes: checkStudentClashes(courseSectionId, day, interval, allocations, students, courses, rooms, excludeAllocationId),
        instructorConflict: checkInstructorConflict(courseSectionId, day, interval, allocations, courses, rooms, excludeAllocationId),
      };
      cache.set(key, result);
    }
    return result;
  };
}

function buildRecommendation(
  day: DayOfWeek,
  slot: TimeSlot,
  room: Room | undefined,
  roomId: string,
  roomConflict: RoomConflictResult,
  window: { studentClashes: StudentConflictResult; instructorConflict: InstructorConflictResult },
  suitability: CapacityCheckResult
): SlotRecommendation {
  const evaluation = evaluateSlot(roomConflict, window.instructorConflict, window.studentClashes, suitability);
  return {
    day,
    slot,
    roomId,
    roomName: room ? room.name : roomId,
    roomCapacity: room?.capacity || 40,
    roomType: room?.type || 'Lecture',
    isRoomFree: !roomConflict.hasConflict,
    roomConflict: roomConflict.hasConflict ? roomConflict : undefined,
    instructorConflict: window.instructorConflict.hasConflict ? window.instructorConflict : undefined,
    suitability,
    studentClashes: window.studentClashes,
    ...evaluation,
  };
}

/**
 * Computes slot recommendations across all days and standard slots for a given room.
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
  const targetRoom = getRoomMap(rooms).get(targetRoomId);
  const course = getCourseMap(courses).get(courseSectionId);
  const suitability = checkRoomSuitability(course, targetRoom, getEnrolledCount(courseSectionId, students));
  const evaluateWindow = createWindowEvaluator(courseSectionId, allocations, students, courses, rooms, excludeAllocationId);

  const recommendations: SlotRecommendation[] = [];

  for (const day of DAYS_OF_WEEK) {
    for (const slot of STANDARD_TIME_SLOTS) {
      const roomConflict = checkRoomConflict(day, slot, targetRoomId, allocations, courses, excludeAllocationId);
      recommendations.push(
        buildRecommendation(day, slot, targetRoom, targetRoomId, roomConflict, evaluateWindow(day, slot), suitability)
      );
    }
  }

  return recommendations;
}

/**
 * Finds all free rooms with Safe (0 clash) or Minor clash recommendations across the week.
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
  const course = getCourseMap(courses).get(courseSectionId);
  const enrolledCount = getEnrolledCount(courseSectionId, students);
  const evaluateWindow = createWindowEvaluator(courseSectionId, allocations, students, courses, rooms, excludeAllocationId);
  const daysToScan = filterDay ? [filterDay] : DAYS_OF_WEEK;

  const allRecommendations: SlotRecommendation[] = [];

  for (const room of rooms) {
    const suitability = checkRoomSuitability(course, room, enrolledCount);
    for (const day of daysToScan) {
      for (const slot of STANDARD_TIME_SLOTS) {
        const roomConflict = checkRoomConflict(day, slot, room.id, allocations, courses, excludeAllocationId);

        // Skip occupied rooms when finding best slots across all rooms
        if (roomConflict.hasConflict) continue;

        allRecommendations.push(
          buildRecommendation(day, slot, room, room.id, roomConflict, evaluateWindow(day, slot), suitability)
        );
      }
    }
  }

  // Sort best options first: SAFE & suitable first, then fewest clashes,
  // and when no room is big enough, the largest rooms first
  return allRecommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.studentClashes.clashCount !== b.studentClashes.clashCount) {
      return a.studentClashes.clashCount - b.studentClashes.clashCount;
    }
    if (a.suitability.overCapacity && b.suitability.overCapacity) {
      return b.roomCapacity - a.roomCapacity;
    }
    return 0;
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

  const course = getCourseMap(courses).get(courseSectionId);
  const enrolledCount = getEnrolledCount(courseSectionId, students);
  const evaluateWindow = createWindowEvaluator(courseSectionId, allocations, students, courses, rooms);
  const allocationsByDay = getAllocationsByDay(allocations);

  const results: FlexibleSlotOption[] = [];
  const STEP_MINUTES = 30; // Scan in 30 min increments (e.g. 08:30, 09:00, ...)

  for (const day of daysToScan) {
    const dayAllocations = allocationsByDay.get(day) || [];
    for (const room of filteredRooms) {
      // Collect all occupied intervals for this room on this day
      const occupiedIntervals = dayAllocations.filter(entry => entry.alloc.roomId === room.id);
      const suitability = checkRoomSuitability(course, room, enrolledCount);

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
        if (hasRoomConflict) continue;

        const { studentClashes, instructorConflict } = evaluateWindow(day, { startMinutes: start, endMinutes: end });

        let status: SlotSafetyStatus = 'SAFE';
        if (instructorConflict.hasConflict || studentClashes.clashCount > 3) {
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
          instructorConflict: instructorConflict.hasConflict ? instructorConflict : undefined,
          suitability,
          status,
        });
      }
    }
  }

  const suitabilityRank = (s: FlexibleSlotOption) =>
    (s.suitability.overCapacity ? 2 : 0) + (s.suitability.roomTypeMismatch ? 1 : 0);

  // Sort: SAFE first, then lowest clash count, then suitable rooms, then day order
  return results.sort((a, b) => {
    if (a.status === 'SAFE' && b.status !== 'SAFE') return -1;
    if (a.status !== 'SAFE' && b.status === 'SAFE') return 1;
    if (a.studentClashes.clashCount !== b.studentClashes.clashCount) {
      return a.studentClashes.clashCount - b.studentClashes.clashCount;
    }
    if (suitabilityRank(a) !== suitabilityRank(b)) {
      return suitabilityRank(a) - suitabilityRank(b);
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

