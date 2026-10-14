import { Allocation, CourseSection, DayOfWeek, Room, Student } from '../types/timetable';
import { DAYS_OF_WEEK } from './constants';
import { isReservedAllocation } from './csvParser';
import { Interval, TIMELINE_STEP_MINUTES, allocationInterval, mergeIntervals } from './timeline';
import { isTimeOverlap } from './utils';

/**
 * Req H – common free time across several sections, at 5-minute resolution.
 *
 * "students": every student enrolled in any course of the chosen sections, with their full personal
 *             timetable (repeat courses with other sections included) – the accurate answer.
 * "sections": only the classes timetabled for the chosen sections themselves.
 */
export type AvailabilityBasis = 'students' | 'sections';

export interface BatchAvailabilityOptions {
  sections: string[];
  basis: AvailabilityBasis;
  allocations: Allocation[];
  courses: CourseSection[];
  students: Student[];
  rooms: Room[];
  dayStart: number;
  dayEnd: number;
  /** Windows may have at most this many busy students (or sections) at any moment */
  maxBusy: number;
  minDuration: number;
}

export interface FreeWindow extends Interval {
  day: DayOfWeek;
  /** Most students (or sections) busy at any moment inside the window – 0 means everyone is free */
  busy: number;
  /** Rooms with nothing booked for the whole window, largest first */
  freeRooms: Room[];
}

export interface DayAvailability {
  day: DayOfWeek;
  /** Busy count for each 5-minute tick from dayStart */
  profile: number[];
  windows: FreeWindow[];
}

export interface BatchAvailabilityResult {
  /** Number of people (students) or sections being checked */
  population: number;
  unit: 'students' | 'sections';
  days: DayAvailability[];
}

export function batchAvailability(o: BatchAvailabilityOptions): BatchAvailabilityResult {
  const chosen = new Set(o.sections);
  const courseById = new Map(o.courses.map((c) => [c.id, c]));
  const step = TIMELINE_STEP_MINUTES;
  const ticks = Math.max(0, Math.ceil((o.dayEnd - o.dayStart) / step));

  // Busy intervals per day for each "unit" (a student, or a section)
  const busyUnits: Map<DayOfWeek, Interval[]>[] = [];

  const bySectionId = new Map<string, Allocation[]>();
  for (const a of o.allocations) {
    if (isReservedAllocation(a.courseSectionId)) continue;
    const list = bySectionId.get(a.courseSectionId);
    if (list) list.push(a);
    else bySectionId.set(a.courseSectionId, [a]);
  }
  const collect = (sectionIds: Iterable<string>) => {
    const perDay = new Map<DayOfWeek, Interval[]>();
    for (const id of Array.from(sectionIds)) {
      for (const a of bySectionId.get(id) || []) {
        const list = perDay.get(a.day) || [];
        list.push(allocationInterval(a));
        perDay.set(a.day, list);
      }
    }
    return perDay;
  };

  if (o.basis === 'students') {
    const chosenCourseIds = new Set(o.courses.filter((c) => chosen.has(c.section)).map((c) => c.id));
    for (const s of o.students) {
      if (s.enrolledSectionIds.some((id) => chosenCourseIds.has(id))) busyUnits.push(collect(s.enrolledSectionIds));
    }
  } else {
    for (const section of Array.from(chosen)) {
      busyUnits.push(collect(o.courses.filter((c) => c.section === section && courseById.has(c.id)).map((c) => c.id)));
    }
  }

  const days = DAYS_OF_WEEK.map((day): DayAvailability => {
    // Difference array: +1 where a unit's (merged) busy time starts, -1 where it ends
    const diff = new Array(ticks + 1).fill(0);
    for (const unit of busyUnits) {
      for (const b of mergeIntervals(unit.get(day) || [])) {
        const from = Math.max(0, Math.floor((b.startMinutes - o.dayStart) / step));
        const to = Math.min(ticks, Math.ceil((b.endMinutes - o.dayStart) / step));
        if (to <= from) continue;
        diff[from]++;
        diff[to]--;
      }
    }
    const profile: number[] = [];
    let running = 0;
    for (let t = 0; t < ticks; t++) {
      running += diff[t];
      profile.push(running);
    }

    // Maximal runs where the busy count stays within the allowance
    const windows: FreeWindow[] = [];
    let runStart = -1;
    let runBusy = 0;
    const close = (end: number) => {
      if (runStart === -1) return;
      const startMinutes = o.dayStart + runStart * step;
      const endMinutes = Math.min(o.dayEnd, o.dayStart + end * step);
      if (endMinutes - startMinutes >= o.minDuration) {
        windows.push({ day, startMinutes, endMinutes, busy: runBusy, freeRooms: freeRoomsFor(day, startMinutes, endMinutes) });
      }
      runStart = -1;
      runBusy = 0;
    };
    for (let t = 0; t < ticks; t++) {
      if (profile[t] <= o.maxBusy) {
        if (runStart === -1) runStart = t;
        runBusy = Math.max(runBusy, profile[t]);
      } else {
        close(t);
      }
    }
    close(ticks);
    return { day, profile, windows };
  });

  function freeRoomsFor(day: DayOfWeek, startMinutes: number, endMinutes: number): Room[] {
    const taken = new Set<string>();
    for (const a of o.allocations) {
      if (a.day !== day) continue;
      const i = allocationInterval(a);
      if (isTimeOverlap(i.startMinutes, i.endMinutes, startMinutes, endMinutes)) taken.add(a.roomId);
    }
    return o.rooms.filter((r) => !taken.has(r.id)).sort((a, b) => b.capacity - a.capacity);
  }

  return { population: busyUnits.length, unit: o.basis === 'students' ? 'students' : 'sections', days };
}

/** Section codes on the timetable (e.g. "BCS-1A"), naturally sorted */
export function sectionCodes(courses: CourseSection[]): string[] {
  return Array.from(new Set(courses.map((c) => c.section))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}
