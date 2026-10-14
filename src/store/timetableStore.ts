import { create } from 'zustand';
import { persist, PersistStorage } from 'zustand/middleware';
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
  INITIAL_DATA_VERSION,
  INITIAL_ROOMS,
  INITIAL_STUDENTS,
} from '../lib/mockData';
import { STANDARD_TIME_SLOTS } from '../lib/constants';
import { timeFieldsForInterval, toTimeInterval } from '../lib/timeline';
import { getAllocationInterval } from '../lib/utils';

interface TimetableStore {
  // Data
  rooms: Room[];
  courses: CourseSection[];
  students: Student[];
  allocations: Allocation[];
  /** Undo steps: what each action changed, so undo reverses only that */
  allocationHistory: HistoryStep[];

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

  // Shared database & coordinator sign-in
  /** local: no database configured · empty: database has no timetable yet */
  syncStatus: 'local' | 'loading' | 'synced' | 'saving' | 'offline' | 'empty';
  canEdit: boolean;
  authEmail: string | null;
  /** Local edits the database has not confirmed yet (retried automatically) */
  pendingChanges: number;
  isCoordinatorModalOpen: boolean;
  openCoordinatorModal: () => void;
  closeCoordinatorModal: () => void;

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
  /** Free window clicked on the grid: the finder then looks only there */
  flexibleGap: FreeGap | null;
  openFlexibleModal: (preselectedCourseId?: string, gap?: FreeGap) => void;
  clearFlexibleGap: () => void;
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

/** Changes to the shared timetable need a signed-in coordinator; viewers get a hint instead. */
function requireEditAccess(
  get: () => TimetableStore,
  set: (partial: Partial<TimetableStore>) => void
): boolean {
  if (get().canEdit) return true;
  set({
    isCoordinatorModalOpen: true,
    toastMessage: { text: 'Enter the edit PIN to change the timetable.', type: 'warning' },
  });
  return false;
}

/** One undo step: each class the action touched, before and after (null = did not exist) */
export interface FreeGap {
  day: DayOfWeek;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
}

export type HistoryStep = { id: string; before: Allocation | null; after: Allocation | null }[];

const MAX_HISTORY = 20;

/** Records what changed between two timetables (unchanged classes keep the same object). */
function pushHistory(history: HistoryStep[], prev: Allocation[], next: Allocation[]): HistoryStep[] {
  const prevById = new Map(prev.map((a) => [a.id, a]));
  const nextIds = new Set(next.map((a) => a.id));
  const step: HistoryStep = [];
  for (const a of next) {
    const before = prevById.get(a.id);
    if (before !== a) step.push({ id: a.id, before: before || null, after: a });
  }
  for (const a of prev) if (!nextIds.has(a.id)) step.push({ id: a.id, before: a, after: null });
  return step.length > 0 ? [...history, step].slice(-MAX_HISTORY) : history;
}

/**
 * Reverses one step against the current timetable. Classes someone else has changed since
 * (current version is no longer this step's "after") are left alone.
 */
export function undoStep(current: Allocation[], step: HistoryStep): { allocations: Allocation[]; skipped: number } {
  const byId = new Map(current.map((a) => [a.id, a]));
  let skipped = 0;
  for (const { id, before, after } of step) {
    const now = byId.get(id) || null;
    const untouched = now === after || (now && after && JSON.stringify(now) === JSON.stringify(after));
    if (!untouched) {
      skipped++;
      continue;
    }
    if (before) byId.set(id, before);
    else byId.delete(id);
  }
  // Keep the original order; restored classes go back where they were
  const result: Allocation[] = [];
  const seen = new Set<string>();
  for (const a of current) {
    const v = byId.get(a.id);
    if (v) result.push(v);
    seen.add(a.id);
  }
  byId.forEach((v, id) => {
    if (!seen.has(id)) result.push(v);
  });
  return { allocations: result, skipped };
}

type PersistedState = Pick<
  TimetableStore,
  'rooms' | 'courses' | 'students' | 'allocations' | 'selectedRoomId' | 'selectedDay'
>;

/**
 * localStorage adapter that only serializes when persisted data actually changed.
 * zustand calls setItem on every state update (opening a modal, typing in search…),
 * and serializing thousands of students each time made the UI sluggish.
 */
let lastPersisted: PersistedState | null = null;
const timetableStorage: PersistStorage<PersistedState> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    const next = value.state;
    const prev = lastPersisted;
    if (prev && (Object.keys(next) as (keyof PersistedState)[]).every((key) => prev[key] === next[key])) {
      return;
    }
    lastPersisted = next;
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch (err) {
      console.warn('Could not save timetable to browser storage (quota exceeded?)', err);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

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
  flexibleGap: null,
  isDataManagerOpen: false,
  isVacantRoomsModalOpen: false,
  vacantRoomsTargetCourseId: null,
  isRescheduleReviewOpen: false,

  toastMessage: null,

  // Edits stay locked until remoteSync knows whether a database is in use
  syncStatus: 'loading',
  canEdit: false,
  authEmail: null,
  pendingChanges: 0,
  isCoordinatorModalOpen: false,
  openCoordinatorModal: () => set({ isCoordinatorModalOpen: true }),
  closeCoordinatorModal: () => set({ isCoordinatorModalOpen: false }),

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
    // Moving to a slot keeps the class's own length: a 105-minute class stays 105 minutes
    let interval = customInterval || null;
    const selected = get().selectedAllocation;
    if (!interval && slot && selected) {
      const current = getAllocationInterval(selected.slotId, selected.customInterval);
      const duration = current.endMinutes - current.startMinutes;
      if (duration !== slot.endMinutes - slot.startMinutes) {
        interval = toTimeInterval(slot.startMinutes, slot.startMinutes + duration);
      }
    }
    set({
      targetDay: day,
      targetSlot: slot,
      targetRoomId: currentTargetRoom,
      targetCustomInterval: interval,
      isImpactModalOpen: true,
    });
  },

  closeImpactModal: () => {
    set({
      isImpactModalOpen: false,
    });
  },

  confirmReschedule: (overrideNote) => {
    if (!requireEditAccess(get, set)) return;
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

    const updatedAllocations = allocations.map((alloc) => {
      if (alloc.id === selectedAllocation.id) {
        return {
          ...alloc,
          day: targetDay,
          ...(targetCustomInterval
            ? timeFieldsForInterval(targetCustomInterval)
            : { slotId: targetSlot!.id, customInterval: undefined }),
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
      allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
      isImpactModalOpen: false,
      isRescheduleDrawerOpen: false,
      selectedAllocation: null,
      selectedCourse: null,
      targetDay: null,
      targetSlot: null,
      toastMessage: {
        text: `Successfully rescheduled ${selectedCourse?.courseCode || 'class'} to ${targetDay} ${
          targetCustomInterval ? `${targetCustomInterval.startTime}–${targetCustomInterval.endTime}` : targetSlot?.label || ''
        }!`,
        type: 'success',
      },
    });
  },

  undoLastReschedule: () => {
    if (!requireEditAccess(get, set)) return;
    const { allocationHistory, allocations } = get();
    if (allocationHistory.length === 0) return;

    const { allocations: restored, skipped } = undoStep(allocations, allocationHistory[allocationHistory.length - 1]);
    const newHistory = allocationHistory.slice(0, -1);

    set({
      allocations: restored,
      allocationHistory: newHistory,
      toastMessage: {
        text:
          skipped > 0
            ? `Undone. ${skipped} class${skipped > 1 ? 'es were' : ' was'} changed by someone else since and left as is.`
            : 'Action undone! Restored prior schedule allocation.',
        type: 'info',
      },
    });
  },

  openFlexibleModal: (preselectedCourseId, gap) => {
    const { courses } = get();
    const course = preselectedCourseId
      ? courses.find((c) => c.id === preselectedCourseId) || null
      : courses[0];
    set({
      isFlexibleModalOpen: true,
      selectedCourse: course,
      flexibleGap: gap || null,
    });
  },
  clearFlexibleGap: () => set({ flexibleGap: null }),

  closeFlexibleModal: () => {
    set({
      isFlexibleModalOpen: false,
      flexibleGap: null,
    });
  },

  createFlexibleAllocation: (courseSectionId, day, roomId, customInterval, note) => {
    if (!requireEditAccess(get, set)) return;
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
      allocationHistory: pushHistory(allocationHistory, allocations, [...allocations, newAlloc]),
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
    if (!requireEditAccess(get, set)) return;
    const { allocations, allocationHistory, courses, rooms } = get();
    const targetAlloc = allocations.find((a) => a.id === allocationId);
    if (!targetAlloc) return;

    const course = courses.find((c) => c.id === targetAlloc.courseSectionId);
    const targetRoom = rooms.find((r) => r.id === newRoomId);
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
      allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
      toastMessage: {
        text: `Moved ${course?.courseCode || 'class'} (${course?.section || ''}) to vacant room ${targetRoom?.name || newRoomId}!`,
        type: 'success',
      },
    });
  },

  openRescheduleReview: () => set({ isRescheduleReviewOpen: true }),
  closeRescheduleReview: () => set({ isRescheduleReviewOpen: false }),

  revertAllocationToOriginal: (allocationId) => {
    if (!requireEditAccess(get, set)) return;
    const { allocations, allocationHistory, courses } = get();
    const targetAlloc = allocations.find((a) => a.id === allocationId);
    if (!targetAlloc) return;

    const course = courses.find((c) => c.id === targetAlloc.courseSectionId);

    // If it was a newly created flexible makeup slot without prior history, remove it
    if (!targetAlloc.rescheduledFrom) {
      const updatedAllocations = allocations.filter((a) => a.id !== allocationId);
      set({
        allocations: updatedAllocations,
        allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
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
      allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
      toastMessage: {
        text: `Reverted ${course?.courseCode || 'course'} back to ${from.day} (${from.roomId})!`,
        type: 'info',
      },
    });
  },

  keepAllocationForWeek: (allocationId) => {
    if (!requireEditAccess(get, set)) return;
    const { allocations, allocationHistory, courses } = get();
    const targetAlloc = allocations.find((a) => a.id === allocationId);
    if (!targetAlloc) return;

    const course = courses.find((c) => c.id === targetAlloc.courseSectionId);

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
      allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
      toastMessage: {
        text: `Confirmed and locked ${course?.courseCode || 'course'} (${course?.section || ''}) for this week.`,
        type: 'success',
      },
    });
  },

  revertAllRescheduled: () => {
    if (!requireEditAccess(get, set)) return;
    const { allocations, allocationHistory } = get();
    const rescheduledCount = allocations.filter((a) => a.isRescheduled).length;
    if (rescheduledCount === 0) return;

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
      allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
      isRescheduleReviewOpen: false,
      toastMessage: {
        text: `Reverted all ${rescheduledCount} weekly reschedules back to original schedule.`,
        type: 'info',
      },
    });
  },

  keepAllRescheduled: () => {
    if (!requireEditAccess(get, set)) return;
    const { allocations, allocationHistory } = get();
    const rescheduledCount = allocations.filter((a) => a.isRescheduled).length;
    if (rescheduledCount === 0) return;

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
      allocationHistory: pushHistory(allocationHistory, allocations, updatedAllocations),
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
    if (!requireEditAccess(get, set)) return;
    const currentState = get();
    const nextRooms = rooms || currentState.rooms;
    const roomStillExists = nextRooms.some((r) => r.id === currentState.selectedRoomId);
    set({
      rooms: nextRooms,
      courses: courses || currentState.courses,
      students: students || currentState.students,
      allocations: allocations || currentState.allocations,
      // Undo snapshots from a previous dataset would mix two timetables
      allocationHistory: allocations ? [] : currentState.allocationHistory,
      selectedRoomId: roomStillExists ? currentState.selectedRoomId : nextRooms[0]?.id || '',
      selectedAllocation: null,
      selectedCourse: null,
      isRescheduleDrawerOpen: false,
      isImpactModalOpen: false,
      toastMessage: {
        text: 'New dataset imported successfully!',
        type: 'success',
      },
    });
  },

  resetToDefaultData: () => {
    if (!requireEditAccess(get, set)) return;
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
    storage: timetableStorage,
    // A newly deployed dataset replaces whatever older timetable a browser has cached
    version: INITIAL_DATA_VERSION,
    migrate: () => ({}) as PersistedState,
    partialize: (state): PersistedState => ({
      rooms: state.rooms,
      courses: state.courses,
      students: state.students,
      allocations: state.allocations,
      selectedRoomId: state.selectedRoomId,
      selectedDay: state.selectedDay,
    }),
  }
));
