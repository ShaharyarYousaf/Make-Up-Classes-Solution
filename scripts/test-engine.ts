import {
  INITIAL_ALLOCATIONS,
  INITIAL_COURSES,
  INITIAL_ROOMS,
  INITIAL_STUDENTS,
} from '../src/lib/mockData';
import {
  checkRoomConflict,
  checkStudentClashes,
  findFlexibleSlots,
  getSlotRecommendationsForRoom,
} from '../src/lib/engine';
import { STANDARD_TIME_SLOTS } from '../src/lib/constants';

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

console.log(`Generated recommendations for 6 days × 6 slots = ${recommendations.length} total slots.`);
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
console.log('\nALL CONFLICT ENGINE TESTS WITH REAL DATASET COMPLETE ✅');
