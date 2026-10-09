export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimeSlot {
  id: string;
  slotNumber: number;
  label: string;
  startTime: string; // '08:30'
  endTime: string;   // '09:50'
  startMinutes: number; // 510
  endMinutes: number;   // 590
  isStandard: boolean;
}

export type RoomType = 'Lecture' | 'Lab' | 'Smart Classroom' | 'Seminar Hall';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  building: string;
  features?: string[];
}

export interface CourseSection {
  id: string; // e.g. "AI4015 BCS-7B"
  courseCode: string; // "AI4015"
  courseTitle: string; // "Agentic Artificial Intelligence"
  section: string; // "BCS-7B"
  department: string; // "Artificial Intelligence"
  creditHours: number; // 3
  instructor: string;
  color: {
    bg: string;
    border: string;
    text: string;
    badge: string;
    accent: string;
  };
}

export interface Student {
  id: string; // "21I-0412"
  name: string; // "Syed Umar Javed"
  enrolledSectionIds: string[]; // ["AI4015 BCS-7B", "CS3001 BAI-5A"]
  degreeProgram: string;
  batch: string;
}

export interface TimeInterval {
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

export interface Allocation {
  id: string;
  courseSectionId: string;
  day: DayOfWeek;
  slotId: string; // maps to a standard TimeSlot id (e.g. 'slot-1') or 'custom'
  customInterval?: TimeInterval;
  roomId: string;
  isRescheduled?: boolean;
  rescheduledFrom?: {
    day: DayOfWeek;
    slotId: string;
    roomId: string;
    customInterval?: TimeInterval;
  };
  note?: string;
  allocatedAt?: string;
}

export interface RoomConflictResult {
  hasConflict: boolean;
  conflictingAllocation?: Allocation;
  conflictingCourse?: CourseSection;
  reason?: string;
}

export interface StudentClashDetail {
  studentId: string;
  studentName: string;
  conflictingAllocationId: string;
  conflictingCourseCode: string;
  conflictingCourseTitle: string;
  conflictingSection: string;
  conflictingRoomId: string;
  conflictingRoomName: string;
  day: DayOfWeek;
  timeSlotLabel: string;
}

export type ClashSeverity = 'SAFE' | 'MINOR' | 'CRITICAL';

export interface StudentConflictResult {
  clashCount: number;
  clashStudents: StudentClashDetail[];
  totalEnrolled: number;
  clashPercentage: number;
  severity: ClashSeverity;
}

export interface InstructorConflictResult {
  hasConflict: boolean;
  conflicts: {
    instructor: string;
    allocation: Allocation;
    course: CourseSection;
    roomName: string;
    timeLabel: string;
  }[];
  reason?: string;
}

export interface CapacityCheckResult {
  overCapacity: boolean;
  roomTypeMismatch: boolean;
  enrolledCount: number;
  capacity: number;
  warnings: string[];
}

export type SlotSafetyStatus = 'SAFE' | 'MINOR_CLASH' | 'BLOCKED';

export interface SlotRecommendation {
  day: DayOfWeek;
  slot: TimeSlot;
  roomId: string;
  roomName: string;
  roomCapacity: number;
  roomType: RoomType;
  isRoomFree: boolean;
  roomConflict?: RoomConflictResult;
  instructorConflict?: InstructorConflictResult;
  suitability: CapacityCheckResult;
  studentClashes: StudentConflictResult;
  status: SlotSafetyStatus;
  statusLabel: string;
  score: number; // Higher is better (0-100)
}

export interface FlexibleSlotOption {
  day: DayOfWeek;
  roomId: string;
  roomName: string;
  roomType: RoomType;
  capacity: number;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  studentClashes: StudentConflictResult;
  instructorConflict?: InstructorConflictResult;
  suitability: CapacityCheckResult;
  status: SlotSafetyStatus;
}

export interface RescheduleState {
  selectedAllocation: Allocation | null;
  selectedCourse: CourseSection | null;
  targetDay?: DayOfWeek;
  targetSlot?: TimeSlot;
  targetRoomId?: string;
  isImpactModalOpen: boolean;
  isDrawerOpen: boolean;
  isExtraSlotModalOpen: boolean;
  isDataManagerOpen: boolean;
}
