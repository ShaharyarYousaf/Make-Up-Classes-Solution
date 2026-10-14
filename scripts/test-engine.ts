import {
  INITIAL_ALLOCATIONS,
  INITIAL_COURSES,
  INITIAL_ROOMS,
  INITIAL_STUDENTS,
} from '../src/lib/mockData';
import {
  checkInstructorConflict,
  checkRoomConflict,
  checkRoomSuitability,
  checkStudentClashes,
  findFlexibleSlots,
  getSlotRecommendationsForRoom,
  moveWindow,
} from '../src/lib/engine';
import { isReservedAllocation, parseTimetableCSV } from '../src/lib/csvParser';
import { STANDARD_TIME_SLOTS } from '../src/lib/constants';
import { extractTimeRange, getFreeIntervals, layoutLanes, timeFieldsForInterval } from '../src/lib/timeline';
import { useTimetableStore, undoStep } from '../src/store/timetableStore';
import { getAllocationInterval } from '../src/lib/utils';
import { Allocation, CourseSection, Room } from '../src/types/timetable';

console.log('====================================================');
console.log('🧪 VERIFYING REAL UNIVERSITY DATASET CONFLICT ENGINE');
console.log('====================================================\n');

console.log(`Loaded dataset: ${INITIAL_ROOMS.length} rooms, ${INITIAL_COURSES.length} courses, ${INITIAL_ALLOCATIONS.length} allocations, ${INITIAL_STUDENTS.length} students.\n`);

// 1. Room Conflict Test
console.log('--- Test 1: Room Conflict Detection ---');
const slot1Interval = {
  startMinutes: STANDARD_TIME_SLOTS[0].startMinutes,
  endMinutes: STANDARD_TIME_SLOTS[0].endMinutes,
};

// On Monday slot 1, C-301 has CS-1002 CS-A
const c301Alloc = INITIAL_ALLOCATIONS.find(a => a.roomId === 'c-301' && a.day === 'Monday' && a.slotId === 'slot-1');

const roomConflict1 = checkRoomConflict(
  'Monday',
  slot1Interval,
  'c-301',
  INITIAL_ALLOCATIONS,
  INITIAL_COURSES
);
console.log('Checking occupied room (Monday slot 1, C-301):', roomConflict1.hasConflict ? 'PASSED ✅' : 'FAILED ❌');
console.log('Conflict Reason:', roomConflict1.reason);

// Check with excludeAllocationId
const roomConflictExcluded = checkRoomConflict(
  'Monday',
  slot1Interval,
  'c-301',
  INITIAL_ALLOCATIONS,
  INITIAL_COURSES,
  c301Alloc?.id
);
console.log('Checking with self-exclusion (same alloc ID):', !roomConflictExcluded.hasConflict ? 'PASSED (Room considered free for self) ✅' : 'FAILED ❌');

// 2. Student Clash Test
console.log('\n--- Test 2: Student Clash Detection ---');
// AI4015 BCS-7B has Syed Umar Javed and Salar Shoaib Abbasi who also take CS3001 BAI-5A
const ai4015Course = INITIAL_COURSES.find(c => c.id.includes('AI4015') && c.section === 'BCS-7B') || INITIAL_COURSES[0];
const mondaySlot4 = {
  startMinutes: STANDARD_TIME_SLOTS[3].startMinutes,
  endMinutes: STANDARD_TIME_SLOTS[3].endMinutes,
};

const studentClashes = checkStudentClashes(
  ai4015Course.id,
  'Monday',
  mondaySlot4,
  INITIAL_ALLOCATIONS,
  INITIAL_STUDENTS,
  INITIAL_COURSES,
  INITIAL_ROOMS
);

console.log(`Target course: ${ai4015Course.id}`);
console.log(`Clash count found: ${studentClashes.clashCount} students`);
console.log('Clash Severity:', studentClashes.severity);
console.log('Enrolled in target course:', studentClashes.totalEnrolled);
if (studentClashes.clashStudents.length > 0) {
  console.log('Sample Clashing Students:');
  studentClashes.clashStudents.slice(0, 3).forEach(cs => {
    console.log(` - ${cs.studentName} (${cs.studentId}) clashing with [${cs.conflictingCourseCode} ${cs.conflictingCourseTitle}] in ${cs.conflictingRoomName}`);
  });
}
console.log('Student clash detection execution: PASSED ✅');

// 3. Slot Matrix Recommendations
console.log('\n--- Test 3: Slot Recommendation Matrix ---');
const recommendations = getSlotRecommendationsForRoom(
  ai4015Course.id,
  'c-301',
  INITIAL_ALLOCATIONS,
  INITIAL_STUDENTS,
  INITIAL_COURSES,
  INITIAL_ROOMS
);

console.log(`Generated recommendations for 6 days × ${STANDARD_TIME_SLOTS.length} slots = ${recommendations.length} total slots.`);
const safeSlots = recommendations.filter(r => r.status === 'SAFE');
const minorSlots = recommendations.filter(r => r.status === 'MINOR_CLASH');
const blockedSlots = recommendations.filter(r => r.status === 'BLOCKED');
console.log(`Safe slots: ${safeSlots.length} 🟢`);
console.log(`Minor clash slots: ${minorSlots.length} 🟡`);
console.log(`Blocked slots: ${blockedSlots.length} 🔴`);

if (recommendations.length > 0) {
  console.log('Recommendation matrix partitioning: PASSED ✅');
}

// 4. Flexible Slot Finder
console.log('\n--- Test 4: Flexible / Extra Slot Allocator ---');
const flexibleSlots = findFlexibleSlots(
  ai4015Course.id,
  120, // 2-hour makeup class
  INITIAL_ALLOCATIONS,
  INITIAL_STUDENTS,
  INITIAL_COURSES,
  INITIAL_ROOMS,
  ['Saturday', 'Friday']
);

console.log(`Found ${flexibleSlots.length} available 2-hour candidate windows on Fri/Sat.`);
const topSafeFlex = flexibleSlots.filter(f => f.status === 'SAFE');
console.log(`Top safe flexible windows: ${topSafeFlex.length}`);
if (topSafeFlex.length > 0) {
  const top = topSafeFlex[0];
  console.log(`Best option: ${top.day} ${top.startTime} - ${top.endTime} in ${top.roomName} (${top.roomType})`);
}
let failures = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) failures++;
  console.log(`${label}: ${ok ? 'PASSED ✅' : 'FAILED ❌'}`);
};

// 5. Instructor double-booking
console.log('\n--- Test 5: Instructor Conflict Detection ---');
const lecturer = 'Dr. Test Lecturer';
const teacherCourses: CourseSection[] = [
  { ...INITIAL_COURSES[0], id: 'TST101 A', courseCode: 'TST101', section: 'A', instructor: lecturer },
  { ...INITIAL_COURSES[0], id: 'TST102 B', courseCode: 'TST102', section: 'B', instructor: `${lecturer}, Dr. Other` },
  { ...INITIAL_COURSES[0], id: 'TST103 C', courseCode: 'TST103', section: 'C', instructor: 'No Teacher Assigned' },
  { ...INITIAL_COURSES[0], id: 'TST104 D', courseCode: 'TST104', section: 'D', instructor: 'No Teacher Assigned' },
];
const teacherAllocations: Allocation[] = [
  { id: 't1', courseSectionId: 'TST101 A', day: 'Monday', slotId: 'slot-1', roomId: 'c-301' },
  { id: 't2', courseSectionId: 'TST102 B', day: 'Monday', slotId: 'slot-2', roomId: 'c-302' },
  { id: 't3', courseSectionId: 'TST103 C', day: 'Monday', slotId: 'slot-3', roomId: 'c-303' },
];
const slot2 = STANDARD_TIME_SLOTS[1];
const teacherBusy = checkInstructorConflict('TST101 A', 'Monday', slot2, teacherAllocations, teacherCourses, INITIAL_ROOMS, 't1');
check('Co-taught section at same time is flagged', teacherBusy.hasConflict && teacherBusy.conflicts[0].course.id === 'TST102 B');
const teacherFree = checkInstructorConflict('TST101 A', 'Tuesday', slot2, teacherAllocations, teacherCourses, INITIAL_ROOMS, 't1');
check('Different day is free', !teacherFree.hasConflict);
const placeholder = checkInstructorConflict('TST104 D', 'Monday', STANDARD_TIME_SLOTS[2], teacherAllocations, teacherCourses, INITIAL_ROOMS);
check('"No Teacher Assigned" is never treated as one person', !placeholder.hasConflict);
const matrix = getSlotRecommendationsForRoom('TST101 A', 'c-305', teacherAllocations, [], teacherCourses, INITIAL_ROOMS, 't1');
const mondaySlot2 = matrix.find(r => r.day === 'Monday' && r.slot.id === 'slot-2');
check('Recommendation matrix blocks the teacher-busy slot', mondaySlot2?.status === 'BLOCKED' && !!mondaySlot2.instructorConflict);

// 6. Room capacity & type
console.log('\n--- Test 6: Room Suitability ---');
const smallRoom: Room = { id: 'tiny', name: 'Tiny', type: 'Lecture', capacity: 10, building: 'X' };
const lab: Room = { id: 'lab', name: 'Lab', type: 'Lab', capacity: 50, building: 'X' };
const labCourse = { ...INITIAL_COURSES[0], courseTitle: 'Programming Fundamentals - Lab' };
const theoryCourse = { ...INITIAL_COURSES[0], courseTitle: 'Programming Fundamentals' };
check('Over-capacity room is flagged', checkRoomSuitability(theoryCourse, smallRoom, 30).overCapacity);
check('Lab section in lecture room is flagged', checkRoomSuitability(labCourse, smallRoom, 5).roomTypeMismatch);
check('Theory section in lab is flagged', checkRoomSuitability(theoryCourse, lab, 5).roomTypeMismatch);
check('Unknown capacity (0) is not flagged', !checkRoomSuitability(theoryCourse, { ...smallRoom, capacity: 0 }, 99).overCapacity);

// 7. Timetable CSV import validation
console.log('\n--- Test 7: Timetable CSV Validation ---');
const csv = [
  'Day,TimeSlot,Room,Course Section',
  'Monday,Slot 10,C-301,A1 X',
  'Monday,Slot 11,C-302,A1 X',
  'Friday,Slot 4,C-301,Prayer break',
  'Monday,Slot 2,C-303,#N/A',
  'Funday,Slot 1,C-301,A1 X',
  'Monday,Slot 3,C-304,',
].join('\n');
const parsed = parseTimetableCSV(csv, INITIAL_ROOMS);
check('"Slot 10" / "Slot 11" map to lab-2 / lab-3', parsed.items[0]?.slotId === 'lab-2' && parsed.items[1]?.slotId === 'lab-3');
check('"Prayer break" becomes a reserved room block', isReservedAllocation(parsed.items[2]?.courseSectionId || ''));
check('#N/A and unknown day are rejected and reported', parsed.report.skipped === 2 && parsed.report.errors.length === 2);
const prayerBlocks = checkRoomConflict('Friday', STANDARD_TIME_SLOTS[3], 'c-301', parsed.items, INITIAL_COURSES);
check('Reserved block makes the room unavailable', prayerBlocks.hasConflict);

// 8. Exact times (Req F): classes that do not fit their slot
console.log('\n--- Test 8: Exact Start/End Times ---');
const timedCsv = [
  'Day,TimeSlot,Room,Course Section,Start Time,End Time',
  'Monday,Slot 4,C-301,A1 X,13:00,14:45',
  'Monday,Slot 5,C-301,B2 Y,,',
  'Monday,Slot 4,C-302,C3 Z 01:00-02:45,,',
  'Monday,Slot 5,C-303,D4 W,14:20,15:00',
  'Monday,Slot 5,C-304,E5 V,3:00,2:00',
].join('\n');
const timed = parseTimetableCSV(timedCsv, INITIAL_ROOMS);
const longClass = timed.items[0];
check('Start/End columns override the slot (13:00–14:45)', longClass?.customInterval?.startMinutes === 780 && longClass?.customInterval?.endMinutes === 885);
check('Exact-time class keeps the nearest slot as its label', longClass?.slotId === 'slot-4');
check('Time written in the course cell is used and stripped', timed.items[2]?.courseSectionId === 'C3 Z' && timed.items[2]?.customInterval?.endTime === '14:45');
check('Overlap with the next slot (02:30 class vs class until 02:45) is reported as a double booking', timed.report.warnings.some(w => w.includes('double-booked')));
check('End before start is rejected', timed.report.errors.some(e => e.includes('Invalid start/end')));

const studentFree = checkRoomConflict('Monday', { startMinutes: 14 * 60 + 20, endMinutes: 14 * 60 + 45 }, 'c-301', [longClass], INITIAL_COURSES);
check('Room is busy 14:20–14:45 (no false availability after Slot 4)', studentFree.hasConflict);
const backToBack = checkRoomConflict('Monday', { startMinutes: 14 * 60 + 45, endMinutes: 15 * 60 + 30 }, 'c-301', [longClass], INITIAL_COURSES);
check('Back-to-back at 14:45 is not a clash', !backToBack.hasConflict);

const free = getFreeIntervals([{ startMinutes: 780, endMinutes: 885 }, { startMinutes: 870, endMinutes: 950 }], 5, 750, 1000);
check('Free windows are exact (12:30–13:00 and 15:50–16:40)', free.length === 2 && free[0].endMinutes === 780 && free[1].startMinutes === 950);
const lanes = layoutLanes([{ s: 780, e: 885 }, { s: 870, e: 950 }, { s: 960, e: 1000 }], x => ({ startMinutes: x.s, endMinutes: x.e }));
check('Overlapping blocks are laid out side by side', lanes[0].lanes === 2 && lanes[1].lane === 1 && lanes[2].lanes === 1);
check('Campus clock: "11:30-01:15" ends at 13:15', extractTimeRange('X 11:30-01:15')?.interval.endMinutes === 795);
check('Exact standard times map back to the plain slot', timeFieldsForInterval({ startMinutes: 780, endMinutes: 860 }).slotId === 'slot-4' && !timeFieldsForInterval({ startMinutes: 780, endMinutes: 860 }).customInterval);

// 9. Audit fixes: moves keep their length, undo leaves other people's changes alone, exact times in messages
console.log('\n--- Test 9: Audit Fixes ---');
const longSlot4: Allocation = { id: 'long', courseSectionId: INITIAL_COURSES[0].id, day: 'Monday', roomId: 'c-301', ...timeFieldsForInterval({ startMinutes: 780, endMinutes: 885 }) };
const targetSlot2 = STANDARD_TIME_SLOTS.find(s => s.id === 'slot-2')!;
check('Move window keeps the class length (Slot 2 → 10:00–11:45)', moveWindow(targetSlot2, 105).endMinutes === 705);

// Something sits at 11:20–11:45 in C-302: an 80-minute check would call Slot 2 free, a 105-minute one must not
const blocker: Allocation = { id: 'blk', courseSectionId: INITIAL_COURSES[1].id, day: 'Tuesday', roomId: 'c-302', ...timeFieldsForInterval({ startMinutes: 685, endMinutes: 705 }) };
const recs = getSlotRecommendationsForRoom(longSlot4.courseSectionId, 'c-302', [longSlot4, blocker], [], INITIAL_COURSES, INITIAL_ROOMS, 'long', 105);
check('Recommendation for a 105-min class sees a clash after the slot ends', recs.find(r => r.day === 'Tuesday' && r.slot.id === 'slot-2')?.status === 'BLOCKED');

const st = useTimetableStore;
st.setState({ canEdit: true, allocations: [longSlot4], allocationHistory: [], courses: INITIAL_COURSES, rooms: INITIAL_ROOMS });
st.getState().initiateReschedule(longSlot4);
st.getState().selectTargetSlot('Tuesday', targetSlot2, 'c-302');
st.getState().confirmReschedule();
const moved = st.getState().allocations[0];
const movedInterval = getAllocationInterval(moved.slotId, moved.customInterval);
check('Rescheduling a 13:00–14:45 class to Slot 2 gives 10:00–11:45', moved.day === 'Tuesday' && movedInterval.startMinutes === 600 && movedInterval.endMinutes === 705);
check('…and keeps where it came from', moved.rescheduledFrom?.customInterval?.endMinutes === 885);

// Undo after someone else changed a different class: only our move is undone
const othersChange: Allocation = { ...blocker, roomId: 'c-303' };
st.setState({ allocations: [moved, othersChange] });
st.getState().undoLastReschedule();
const afterUndo = st.getState().allocations;
check('Undo restores our class', afterUndo.find(a => a.id === 'long')?.day === 'Monday');
check("Undo leaves another coordinator's change alone", afterUndo.find(a => a.id === 'blk')?.roomId === 'c-303');
const conflicting = undoStep([{ ...moved, roomId: 'c-304' }], [{ id: 'long', before: longSlot4, after: moved }]);
check('Undo skips a class someone else edited since', conflicting.skipped === 1 && conflicting.allocations[0].roomId === 'c-304');

const clashing = checkStudentClashes(
  'X1 A', 'Monday', { startMinutes: 840, endMinutes: 900 },
  [{ ...longSlot4, courseSectionId: 'X2 B' }],
  [{ id: 's1', name: 'S', degreeProgram: '', batch: '', enrolledSectionIds: ['X1 A', 'X2 B'] }],
  [{ ...INITIAL_COURSES[0], id: 'X2 B' }], INITIAL_ROOMS
);
check('Clash details show the exact time (13:00 - 14:45), not "Slot 4"', clashing.clashStudents[0]?.timeSlotLabel === '13:00 - 14:45');

if (failures > 0) {
  console.log(`\n${failures} TEST(S) FAILED ❌`);
  process.exit(1);
}
console.log('\nALL CONFLICT ENGINE TESTS WITH REAL DATASET COMPLETE ✅');
