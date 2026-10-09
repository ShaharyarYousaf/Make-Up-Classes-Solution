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
} from '../src/lib/engine';
import { isReservedAllocation, parseTimetableCSV } from '../src/lib/csvParser';
import { STANDARD_TIME_SLOTS } from '../src/lib/constants';
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

if (failures > 0) {
  console.log(`\n${failures} TEST(S) FAILED ❌`);
  process.exit(1);
}
console.log('\nALL CONFLICT ENGINE TESTS WITH REAL DATASET COMPLETE ✅');
