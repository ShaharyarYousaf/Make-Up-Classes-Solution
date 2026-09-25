import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Allocation,
  CourseSection,
  DayOfWeek,
  Room,
  Student,
  TimeInterval,
  TimeSlot,
} from '../types/timetable';
import {
  INITIAL_ALLOCATIONS,
  INITIAL_COURSES,
  INITIAL_ROOMS,
  INITIAL_STUDENTS,
} from '../lib/mockData';
import { STANDARD_TIME_SLOTS } from '../lib/constants';

interface TimetableStore {
  // Data
  rooms: Room[];
  courses: CourseSection[];
  students: Student[];
  allocations: Allocation[];
  allocationHistory: Allocation[][];

  // View state
  viewMode: 'room' | 'day';
  selectedRoomId: string;
  selectedDay: DayOfWeek;
  searchQuery: string;
  departmentFilter: string;

  // Reschedule & Impact modal state
  selectedAllocation: Allocation | null;
  selectedCourse: CourseSection | null;
  targetRoomId: string;
  targetDay: DayOfWeek | null;
  targetSlot: TimeSlot | null;
  targetCustomInterval: TimeInterval | null;
  isRescheduleDrawerOpen: boolean;
  isImpactModalOpen: boolean;
  isFlexibleModalOpen: boolean;
  isDataManagerOpen: boolean;
  isVacantRoomsModalOpen: boolean;
  vacantRoomsTargetCourseId: string | null;
  isRescheduleReviewOpen: boolean;

  // Notification / Toast
  toastMessage: { text: string; type: 'success' | 'info' | 'warning' } | null;

  // Actions
  setViewMode: (mode: 'room' | 'day') => void;
  setSelectedRoomId: (roomId: string) => void;
  setSelectedDay: (day: DayOfWeek) => void;
  setSearchQuery: (query: string) => void;
  setDepartmentFilter: (dept: string) => void;
  setTargetRoomId: (roomId: string) => void;

  // Rescheduling workflow
  initiateReschedule: (allocation: Allocation) => void;
  closeRescheduleDrawer: () => void;
  selectTargetSlot: (
    day: DayOfWeek,
    slot: TimeSlot,
    roomId?: string,
    customInterval?: TimeInterval
  ) => void;
  closeImpactModal: () => void;
  confirmReschedule: (overrideNote?: string) => void;
  undoLastReschedule: () => void;

  // Flexible makeup slot
  openFlexibleModal: (preselectedCourseId?: string) => void;
  closeFlexibleModal: () => void;
  createFlexibleAllocation: (
    courseSectionId: string,
    day: DayOfWeek,
    roomId: string,
    customInterval: TimeInterval,
    note?: string
  ) => void;

  // Vacant Rooms & Direct Reassign
  openVacantRoomsModal: (preselectedCourseId?: string) => void;
  closeVacantRoomsModal: () => void;
  reassignRoom: (allocationId: string, newRoomId: string, note?: string) => void;

  // Weekly Rescheduled Classes Review & Actions
  openRescheduleReview: () => void;
  closeRescheduleReview: () => void;
  revertAllocationToOriginal: (allocationId: string) => void;
  keepAllocationForWeek: (allocationId: string) => void;
  revertAllRescheduled: () => void;
  keepAllRescheduled: () => void;

  // Data management
  openDataManager: () => void;
  closeDataManager: () => void;
  importDatasets: (payload: {
    rooms?: Room[];
    courses?: CourseSection[];
    students?: Student[];
    allocations?: Allocation[];
  }) => void;
  resetToDefaultData: () => void;
  clearToast: () => void;
  showToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

export const useTimetableStore = create<TimetableStore>()(
  persist(
    (set, get) => ({
      rooms: INITIAL_ROOMS,
  courses: INITIAL_COURSES,
  students: INITIAL_STUDENTS,
  allocations: INITIAL_ALLOCATIONS,
  allocationHistory: [],

  viewMode: 'room',
  selectedRoomId: INITIAL_ROOMS[0].id,
  selectedDay: 'Monday',
  searchQuery: '',
  departmentFilter: 'ALL',

  selectedAllocation: null,
  selectedCourse: null,
  targetRoomId: INITIAL_ROOMS[0].id,
  targetDay: null,
  targetSlot: null,
  targetCustomInterval: null,
  isRescheduleDrawerOpen: false,
  isImpactModalOpen: false,
  isFlexibleModalOpen: false,
  isDataManagerOpen: false,
  isVacantRoomsModalOpen: false,
  vacantRoomsTargetCourseId: null,
  isRescheduleReviewOpen: false,

  toastMessage: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedRoomId: (roomId) => set({ selectedRoomId: roomId }),
  setSelectedDay: (day) => set({ selectedDay: day }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDepartmentFilter: (dept) => set({ departmentFilter: dept }),
  setTargetRoomId: (roomId) => set({ targetRoomId: roomId }),

  initiateReschedule: (allocation: Allocation) => {
    const { courses } = get();
    const course = courses.find((c) => c.id === allocation.courseSectionId) || null;
    set({
      selectedAllocation: allocation,
      selectedCourse: course,
      targetRoomId: allocation.roomId,
      targetDay: null,
      targetSlot: null,
      targetCustomInterval: null,
      isRescheduleDrawerOpen: true,
      isImpactModalOpen: false,
    });
  },

  closeRescheduleDrawer: () => {
    set({
      isRescheduleDrawerOpen: false,
      selectedAllocation: null,
      selectedCourse: null,
      targetDay: null,
      targetSlot: null,
    });
  },

  selectTargetSlot: (day, slot, roomId, customInterval) => {
    const currentTargetRoom = roomId || get().targetRoomId || get().selectedAllocation?.roomId || INITIAL_ROOMS[0].id;
    set({
      targetDay: day,
      targetSlot: slot,
      targetRoomId: currentTargetRoom,
      targetCustomInterval: customInterval || null,
      isImpactModalOpen: true,
    });
  },

  closeImpactModal: () => {
    set({
      isImpactModalOpen: false,
    });
  },

  confirmReschedule: (overrideNote) => {
    const {
      selectedAllocation,
      selectedCourse,
      targetDay,
      targetSlot,
      targetRoomId,
      targetCustomInterval,
      allocations,
      allocationHistory,
    } = get();

    if (!selectedAllocation || !targetDay || (!targetSlot && !targetCustomInterval)) {
      return;
    }

    // Save previous state for Undo
    const nextHistory = [...allocationHistory, allocations];

    const updatedAllocations = allocations.map((alloc) => {
      if (alloc.id === selectedAllocation.id) {
        return {
          ...alloc,
          day: targetDay,
          slotId: targetSlot ? targetSlot.id : 'custom',
          customInterval: targetCustomInterval || undefined,
          roomId: targetRoomId,
          isRescheduled: true,
          rescheduledFrom: alloc.rescheduledFrom || {
            day: alloc.day,
            slotId: alloc.slotId,
            roomId: alloc.roomId,
            customInterval: alloc.customInterval,
          },
          note: overrideNote || 'Rescheduled via Smart Assistant',
          allocatedAt: new Date().toISOString(),
        };
      }
      return alloc;
    });

    set({
      allocations: updatedAllocations,
      allocationHistory: nextHistory,
      isImpactModalOpen: false,
      isRescheduleDrawerOpen: false,
      selectedAllocation: null,
      selectedCourse: null,
      targetDay: null,
      targetSlot: null,
      toastMessage: {
        text: `Successfully rescheduled ${selectedCourse?.courseCode || 'class'} to ${targetDay} ${targetSlot ? targetSlot.label : 'Custom Slot'}!`,
        type: 'success',
      },
    });
  },

  undoLastReschedule: () => {
    const { allocationHistory } = get();
    if (allocationHistory.length === 0) return;

    const previousAllocations = allocationHistory[allocationHistory.length - 1];
    const newHistory = allocationHistory.slice(0, -1);

    set({
      allocations: previousAllocations,
      allocationHistory: newHistory,
      toastMessage: {
        text: 'Action undone! Restored prior schedule allocation.',
        type: 'info',
      },
    });
  },

  openFlexibleModal: (preselectedCourseId) => {
    const { courses } = get();
    const course = preselectedCourseId
      ? courses.find((c) => c.id === preselectedCourseId) || null
      : courses[0];
    set({
      isFlexibleModalOpen: true,
      selectedCourse: course,
    });
  },

  closeFlexibleModal: () => {
    set({
      isFlexibleModalOpen: false,
    });
  },

  createFlexibleAllocation: (courseSectionId, day, roomId, customInterval, note) => {
    const { allocations, allocationHistory, courses } = get();
    const course = courses.find((c) => c.id === courseSectionId);

    const newAlloc: Allocation = {
      id: `alloc-custom-${Date.now()}`,
      courseSectionId,
      day,
      slotId: 'custom',
      customInterval,
      roomId,
      isRescheduled: true,
      note: note || 'Flexible / Makeup Session',
      allocatedAt: new Date().toISOString(),
    };

    set({
      allocations: [...allocations, newAlloc],
      allocationHistory: [...allocationHistory, allocations],
      isFlexibleModalOpen: false,
      toastMessage: {
        text: `Allocated extra slot for ${course?.courseCode || courseSectionId} on ${day} (${customInterval.startTime} - ${customInterval.endTime})`,
        type: 'success',
      },
    });
  },

  openVacantRoomsModal: (preselectedCourseId) => {
    set({
      isVacantRoomsModalOpen: true,
      vacantRoomsTargetCourseId: preselectedCourseId || null,
    });
  },

  closeVacantRoomsModal: () => {
    set({
      isVacantRoomsModalOpen: false,
      vacantRoomsTargetCourseId: null,
    });
  },

  reassignRoom: (allocationId, newRoomId, note) => {
    const { allocations, allocationHistory, courses, rooms } = get();
    const targetAlloc = allocations.find((a) => a.id === allocationId);
    if (!targetAlloc) return;

    const course = courses.find((c) => c.id === targetAlloc.courseSectionId);
    const targetRoom = rooms.find((r) => r.id === newRoomId);

    const nextHistory = [...allocationHistory, allocations];
    const updatedAllocations = allocations.map((a) => {
      if (a.id === allocationId) {
        return {
          ...a,
          roomId: newRoomId,
          isRescheduled: true,
          rescheduledFrom: a.rescheduledFrom || {
            day: a.day,
            slotId: a.slotId,
            roomId: a.roomId,
            customInterval: a.customInterval,
          },
          note: note || `Room reassigned to ${targetRoom?.name || newRoomId}`,
          allocatedAt: new Date().toISOString(),
        };
      }
      return a;
    });

    set({
      allocations: updatedAllocations,
      allocationHistory: nextHistory,
      toastMessage: {
        text: `Moved ${course?.courseCode || 'class'} (${course?.section || ''}) to vacant room ${targetRoom?.name || newRoomId}!`,
        type: 'success',
      },
    });
  },

  openRescheduleReview: () => set({ isRescheduleReviewOpen: true }),
  closeRescheduleReview: () => set({ isRescheduleReviewOpen: false }),

  revertAllocationToOriginal: (allocationId) => {
    const { allocations, allocationHistory, courses } = get();
    const targetAlloc = allocations.find((a) => a.id === allocationId);
    if (!targetAlloc) return;

    const course = courses.find((c) => c.id === targetAlloc.courseSectionId);
    const nextHistory = [...allocationHistory, allocations];

    // If it was a newly created flexible makeup slot without prior history, remove it
    if (!targetAlloc.rescheduledFrom) {
      const updatedAllocations = allocations.filter((a) => a.id !== allocationId);
      set({
        allocations: updatedAllocations,
        allocationHistory: nextHistory,
        toastMessage: {
          text: `Removed makeup session for ${course?.courseCode || 'course'}`,
          type: 'info',
        },
      });
      return;
    }

    // Otherwise restore original slot and room
    const from = targetAlloc.rescheduledFrom;
    const updatedAllocations = allocations.map((a) => {
      if (a.id === allocationId) {
        return {
          ...a,
          day: from.day,
          slotId: from.slotId,
          roomId: from.roomId,
          customInterval: from.customInterval,
          isRescheduled: false,
          rescheduledFrom: undefined,
          note: undefined,
          allocatedAt: new Date().toISOString(),
        };
      }
      return a;
    });

    set({
      allocations: updatedAllocations,
      allocationHistory: nextHistory,
      toastMessage: {
        text: `Reverted ${course?.courseCode || 'course'} back to ${from.day} (${from.roomId})!`,
        type: 'info',
      },
    });
  },

  keepAllocationForWeek: (allocationId) => {
    const { allocations, allocationHistory, courses } = get();
    const targetAlloc = allocations.find((a) => a.id === allocationId);
    if (!targetAlloc) return;

    const course = courses.find((c) => c.id === targetAlloc.courseSectionId);
    const nextHistory = [...allocationHistory, allocations];

    const updatedAllocations = allocations.map((a) => {
      if (a.id === allocationId) {
        return {
          ...a,
          isRescheduled: false,
          rescheduledFrom: undefined,
          note: a.note ? `Confirmed for current week: ${a.note}` : 'Confirmed for current week',
        };
      }
      return a;
    });

    set({
      allocations: updatedAllocations,
      allocationHistory: nextHistory,
      toastMessage: {
        text: `Confirmed and locked ${course?.courseCode || 'course'} (${course?.section || ''}) for this week.`,
        type: 'success',
      },
    });
  },

  revertAllRescheduled: () => {
    const { allocations, allocationHistory } = get();
    const rescheduledCount = allocations.filter((a) => a.isRescheduled).length;
    if (rescheduledCount === 0) return;

    const nextHistory = [...allocationHistory, allocations];

    const updatedAllocations = allocations
      .filter((a) => !(a.isRescheduled && !a.rescheduledFrom))
      .map((a) => {
        if (a.isRescheduled && a.rescheduledFrom) {
          return {
            ...a,
            day: a.rescheduledFrom.day,
            slotId: a.rescheduledFrom.slotId,
            roomId: a.rescheduledFrom.roomId,
            customInterval: a.rescheduledFrom.customInterval,
            isRescheduled: false,
            rescheduledFrom: undefined,
            note: undefined,
            allocatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

    set({
      allocations: updatedAllocations,
      allocationHistory: nextHistory,
      isRescheduleReviewOpen: false,
      toastMessage: {
        text: `Reverted all ${rescheduledCount} weekly reschedules back to original schedule.`,
        type: 'info',
      },
    });
  },

  keepAllRescheduled: () => {
    const { allocations, allocationHistory } = get();
    const rescheduledCount = allocations.filter((a) => a.isRescheduled).length;
    if (rescheduledCount === 0) return;

    const nextHistory = [...allocationHistory, allocations];

    const updatedAllocations = allocations.map((a) => {
      if (a.isRescheduled) {
        return {
          ...a,
          isRescheduled: false,
          rescheduledFrom: undefined,
          note: a.note ? `Confirmed for week: ${a.note}` : 'Confirmed for current week',
        };
      }
      return a;
    });

    set({
      allocations: updatedAllocations,
      allocationHistory: nextHistory,
      isRescheduleReviewOpen: false,
      toastMessage: {
        text: `Confirmed all ${rescheduledCount} rescheduled classes for the current week.`,
        type: 'success',
      },
    });
  },

  openDataManager: () => set({ isDataManagerOpen: true }),
  closeDataManager: () => set({ isDataManagerOpen: false }),

  importDatasets: ({ rooms, courses, students, allocations }) => {
    const currentState = get();
    set({
      rooms: rooms || currentState.rooms,
      courses: courses || currentState.courses,
      students: students || currentState.students,
      allocations: allocations || currentState.allocations,
      isDataManagerOpen: false,
      toastMessage: {
        text: 'New dataset imported successfully!',
        type: 'success',
      },
    });
  },

  resetToDefaultData: () => {
    set({
      rooms: INITIAL_ROOMS,
      courses: INITIAL_COURSES,
      students: INITIAL_STUDENTS,
      allocations: INITIAL_ALLOCATIONS,
      allocationHistory: [],
      selectedAllocation: null,
      selectedCourse: null,
      isRescheduleDrawerOpen: false,
      isImpactModalOpen: false,
      isFlexibleModalOpen: false,
      toastMessage: {
        text: 'Reset to default FAST-NUCES university timetable data.',
        type: 'info',
      },
    });
  },

    clearToast: () => set({ toastMessage: null }),
    showToast: (text, type = 'info') => set({ toastMessage: { text, type } }),
  }),
  {
    name: 'unischedule_master_storage',
    partialize: (state) => ({
      rooms: state.rooms,
      courses: state.courses,
      students: state.students,
      allocations: state.allocations,
      allocationHistory: state.allocationHistory,
      selectedRoomId: state.selectedRoomId,
      selectedDay: state.selectedDay,
    }),
  }
));
