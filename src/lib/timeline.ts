import { Allocation, TimeInterval } from '../types/timetable';
import { CAMPUS_DAY_END_MINUTES, CAMPUS_DAY_START_MINUTES, STANDARD_TIME_SLOTS } from './constants';
import { getAllocationInterval, minutesToTimeString } from './utils';

/** Base unit of the continuous timeline. Every slot boundary on campus is a multiple of 5 minutes. */
export const TIMELINE_STEP_MINUTES = 5;

export interface Interval {
  startMinutes: number;
  endMinutes: number;
}

export const snapToStep = (minutes: number) =>
  Math.round(minutes / TIMELINE_STEP_MINUTES) * TIMELINE_STEP_MINUTES;

export function toTimeInterval(startMinutes: number, endMinutes: number): TimeInterval {
  return {
    startMinutes,
    endMinutes,
    startTime: minutesToTimeString(startMinutes),
    endTime: minutesToTimeString(endMinutes),
  };
}

/** Sorts and merges overlapping or touching intervals into a minimal busy list. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.endMinutes > i.startMinutes)
    .map((i) => ({ startMinutes: i.startMinutes, endMinutes: i.endMinutes }))
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, interval.endMinutes);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/**
 * Exact free windows between busy intervals inside [dayStart, dayEnd).
 * Windows shorter than minDuration are dropped.
 */
export function getFreeIntervals(
  busy: Interval[],
  minDuration = TIMELINE_STEP_MINUTES,
  dayStart = CAMPUS_DAY_START_MINUTES,
  dayEnd = CAMPUS_DAY_END_MINUTES
): Interval[] {
  const free: Interval[] = [];
  let cursor = dayStart;
  for (const b of mergeIntervals(busy)) {
    if (b.endMinutes <= dayStart) continue;
    if (b.startMinutes >= dayEnd) break;
    if (b.startMinutes > cursor) free.push({ startMinutes: cursor, endMinutes: b.startMinutes });
    cursor = Math.max(cursor, b.endMinutes);
  }
  if (cursor < dayEnd) free.push({ startMinutes: cursor, endMinutes: dayEnd });
  return free.filter((f) => f.endMinutes - f.startMinutes >= minDuration);
}

/**
 * Best label slot for an exact interval: the standard slot it overlaps most
 * (ties go to the slot whose start is closest). Returns undefined when nothing overlaps.
 */
export function nearestSlotId(interval: Interval): string | undefined {
  let best: { id: string; overlap: number; startGap: number } | undefined;
  for (const slot of STANDARD_TIME_SLOTS) {
    const overlap =
      Math.min(interval.endMinutes, slot.endMinutes) - Math.max(interval.startMinutes, slot.startMinutes);
    if (overlap <= 0) continue;
    const startGap = Math.abs(slot.startMinutes - interval.startMinutes);
    if (!best || overlap > best.overlap || (overlap === best.overlap && startGap < best.startGap)) {
      best = { id: slot.id, overlap, startGap };
    }
  }
  return best?.id;
}

/**
 * Builds an allocation's time fields from exact minutes: a standard slot when it matches exactly,
 * otherwise the nearest slot as a label plus the exact customInterval.
 */
export function timeFieldsForInterval(interval: Interval): Pick<Allocation, 'slotId' | 'customInterval'> {
  const exact = STANDARD_TIME_SLOTS.find(
    (s) => s.startMinutes === interval.startMinutes && s.endMinutes === interval.endMinutes
  );
  if (exact) return { slotId: exact.id, customInterval: undefined };
  return {
    slotId: nearestSlotId(interval) || 'custom',
    customInterval: toTimeInterval(interval.startMinutes, interval.endMinutes),
  };
}

export interface LaidOutEvent<T> {
  item: T;
  startMinutes: number;
  endMinutes: number;
  /** Column index within an overlap group */
  lane: number;
  /** Number of lanes in the overlap group */
  lanes: number;
}

/** Places overlapping events side by side, like a calendar day column. */
export function layoutLanes<T>(items: T[], getInterval: (item: T) => Interval): LaidOutEvent<T>[] {
  const events = items
    .map((item) => ({ item, ...getInterval(item), lane: 0, lanes: 1 }))
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  let group: typeof events = [];
  let groupEnd = -1;
  const closeGroup = () => {
    const lanes = group.reduce((max, e) => Math.max(max, e.lane + 1), 1);
    group.forEach((e) => (e.lanes = lanes));
    group = [];
  };

  for (const event of events) {
    if (event.startMinutes >= groupEnd) {
      closeGroup();
      groupEnd = -1;
    }
    const laneEnds: number[] = [];
    for (const other of group) laneEnds[other.lane] = Math.max(laneEnds[other.lane] ?? -1, other.endMinutes);
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] > event.startMinutes) lane++;
    event.lane = lane;
    group.push(event);
    groupEnd = Math.max(groupEnd, event.endMinutes);
  }
  closeGroup();
  return events;
}

const TIME_RANGE_PATTERN = /(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*[-–—]\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/i;

/** Clock time as written on the campus timetable: no am/pm, so 01:00–07:59 means afternoon/evening. */
function campusClockToMinutes(hours: number, minutes: number, meridiem?: string): number {
  if (meridiem) {
    const pm = meridiem.toLowerCase() === 'pm';
    return ((hours % 12) + (pm ? 12 : 0)) * 60 + minutes;
  }
  return (hours < 8 ? hours + 12 : hours) * 60 + minutes;
}

/**
 * Finds a time range such as "01:00-02:45", "13:00 - 14:45" or "9:30am-11:20am" inside text.
 * Returns the exact interval plus the text with the range removed.
 */
export function extractTimeRange(text: string): { interval: Interval; rest: string } | undefined {
  const match = text.match(TIME_RANGE_PATTERN);
  if (!match) return undefined;
  const startMinutes = campusClockToMinutes(Number(match[1]), Number(match[2]), match[3]);
  let endMinutes = campusClockToMinutes(Number(match[4]), Number(match[5]), match[6] || match[3]);
  // "11:30-01:15": the end wrapped past noon
  if (endMinutes <= startMinutes) endMinutes += 12 * 60;
  if (endMinutes - startMinutes > 6 * 60) return undefined;
  return {
    interval: { startMinutes, endMinutes },
    rest: (text.slice(0, match.index) + text.slice(match.index! + match[0].length)).replace(/\s+/g, ' ').trim(),
  };
}

/** Parses a single clock value ("13:00", "01:00", "1:00 pm"). */
export function parseClockTime(text: string): number | undefined {
  const match = text.trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!match) return undefined;
  return campusClockToMinutes(Number(match[1]), Number(match[2]), match[3]);
}

export const allocationInterval =(alloc: Allocation): Interval =>
  getAllocationInterval(alloc.slotId, alloc.customInterval);

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};
