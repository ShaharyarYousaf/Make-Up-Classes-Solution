import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Allocation, CourseSection, DayOfWeek, Room, TimeSlot } from '../types/timetable';
import { getReservedLabel, isReservedAllocation } from '../lib/csvParser';
import {
  allocationInterval,
  formatDuration,
  getFreeIntervals,
  layoutLanes,
} from '../lib/timeline';
import { minutesToTimeString } from '../lib/utils';
import { CourseCard } from './CourseCard';

/** Vertical scale of the timeline: an 80-minute slot is 128px tall */
const PX_PER_MINUTE = 1.6;
/** Free gaps shorter than this are not worth offering for a make-up class */
const MIN_FREE_MINUTES = 30;

export interface TimelineColumn {
  key: string;
  day: DayOfWeek;
  roomId: string;
  header: React.ReactNode;
  allocations: Allocation[];
  /** Room shown on cards; in the day view every column is a room */
  roomFor: (alloc: Allocation) => Room;
  /** Shown on free blocks, e.g. "Monday" or "C-301" */
  freeLabel: string;
}

interface TimelineColumnsProps {
  columns: TimelineColumn[];
  columnWidth: number;
  /** Slot bands drawn behind the columns so the familiar slots stay visible */
  bands: TimeSlot[];
  dayStart: number;
  dayEnd: number;
  courseMap: Map<string, CourseSection>;
  enrolledCount: (sectionId: string) => number;
  isVisible: (alloc: Allocation) => boolean;
  onFreeClick: (gap: { day: DayOfWeek; roomId: string; startMinutes: number; endMinutes: number }) => void;
}

const fmt = minutesToTimeString;

export const TimelineColumns: React.FC<TimelineColumnsProps> = ({
  columns,
  columnWidth,
  bands,
  dayStart,
  dayEnd,
  courseMap,
  enrolledCount,
  isVisible,
  onFreeClick,
}) => {
  const height = (dayEnd - dayStart) * PX_PER_MINUTE;
  const y = (minutes: number) => (minutes - dayStart) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let h = Math.ceil(dayStart / 60) * 60; h < dayEnd; h += 60) hours.push(h);

  return (
    <div
      className="grid gap-x-2"
      style={{ gridTemplateColumns: `112px repeat(${columns.length}, minmax(${columnWidth}px, 1fr))` }}
    >
      {/* Header row */}
      <div className="sticky left-0 top-0 z-30 outline outline-4 outline-slate-50 dark:outline-zinc-950 p-2.5 text-center text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-300 dark:border-zinc-700 flex items-center justify-center shadow-xs">
        Time
      </div>
      {columns.map((col) => (
        <div key={col.key} className="sticky top-0 z-20 -mx-1 px-1 pb-1 bg-slate-50 dark:bg-zinc-950">
          {col.header}
        </div>
      ))}

      {/* Time axis: slot bands with their labels */}
      <div className="sticky left-0 z-20 mt-2 relative bg-white/95 dark:bg-zinc-900/95 rounded-xl border border-gray-200 dark:border-zinc-700" style={{ height }}>
        {bands.map((slot) => (
          <div
            key={slot.id}
            className="absolute inset-x-1 rounded-lg bg-slate-100 dark:bg-zinc-800/80 flex flex-col justify-center items-center text-center"
            style={{ top: y(slot.startMinutes), height: (slot.endMinutes - slot.startMinutes) * PX_PER_MINUTE }}
          >
            <span className="text-[11px] font-black text-gray-800 dark:text-gray-200">
              {slot.id.startsWith('lab') ? `Lab ${slot.slotNumber - 8}` : `Slot ${slot.slotNumber}`}
            </span>
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
              {slot.startTime}–{slot.endTime}
            </span>
          </div>
        ))}
      </div>

      {/* One timeline per column */}
      {columns.map((col) => {
        const laidOut = layoutLanes(col.allocations, allocationInterval);
        const free = getFreeIntervals(
          laidOut.map((e) => ({ startMinutes: e.startMinutes, endMinutes: e.endMinutes })),
          MIN_FREE_MINUTES,
          dayStart,
          dayEnd
        );

        return (
          <div
            key={col.key}
            className="relative mt-2 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/50"
            style={{ height }}
          >
            {/* Slot bands and hour lines for orientation */}
            {bands.map((slot) => (
              <div
                key={slot.id}
                className="absolute inset-x-0 bg-slate-50 dark:bg-zinc-800/30 pointer-events-none"
                style={{ top: y(slot.startMinutes), height: (slot.endMinutes - slot.startMinutes) * PX_PER_MINUTE }}
              />
            ))}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-gray-200/70 dark:border-zinc-700/50 pointer-events-none"
                style={{ top: y(h) }}
              />
            ))}

            {/* Exact free windows */}
            {free.map((f) => (
              <button
                key={`free-${f.startMinutes}`}
                type="button"
                onClick={() => onFreeClick({ day: col.day, roomId: col.roomId, ...f })}
                className="absolute inset-x-1 rounded-lg border border-transparent hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/80 dark:hover:bg-blue-950/30 flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500 group transition-all"
                style={{ top: y(f.startMinutes) + 2, height: (f.endMinutes - f.startMinutes) * PX_PER_MINUTE - 4 }}
                title={`${col.freeLabel} is free ${fmt(f.startMinutes)}–${fmt(f.endMinutes)} – click to plan a make-up class`}
              >
                <span className="text-[11px] font-semibold flex items-center gap-1 opacity-70 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                  Free {fmt(f.startMinutes)}–{fmt(f.endMinutes)}
                </span>
                <span className="text-[9px] font-mono opacity-60">{formatDuration(f.endMinutes - f.startMinutes)}</span>
              </button>
            ))}

            {/* Classes and room blocks at their exact times */}
            {laidOut.map(({ item: alloc, startMinutes, endMinutes, lane, lanes }) => {
              const course = courseMap.get(alloc.courseSectionId);
              const style: React.CSSProperties = {
                top: y(startMinutes) + 1,
                height: (endMinutes - startMinutes) * PX_PER_MINUTE - 2,
                left: `calc(${(lane / lanes) * 100}% + 2px)`,
                width: `calc(${100 / lanes}% - 4px)`,
              };
              const time = `${fmt(startMinutes)}–${fmt(endMinutes)}`;

              if (!course) {
                const reserved = isReservedAllocation(alloc.courseSectionId);
                return (
                  <div
                    key={alloc.id}
                    className="absolute z-10 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex flex-col items-center justify-center text-center p-1 overflow-hidden"
                    style={style}
                    title={`${reserved ? 'Reserved' : 'Not in course list'} ${time}`}
                  >
                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 line-clamp-2">
                      {reserved ? getReservedLabel(alloc.courseSectionId) : alloc.courseSectionId}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500">{time}</span>
                  </div>
                );
              }

              if (!isVisible(alloc)) {
                // Filtered out by search, but the time is still taken
                return (
                  <div
                    key={alloc.id}
                    className="absolute z-10 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/60 flex items-center justify-center text-[10px] text-gray-400 overflow-hidden"
                    style={style}
                    title={`${course.courseCode} ${course.section} ${time}`}
                  >
                    Busy {time}
                  </div>
                );
              }

              return (
                <div key={alloc.id} className="absolute z-10 hover:z-20" style={style}>
                  <CourseCard
                    allocation={alloc}
                    course={course}
                    room={col.roomFor(alloc)}
                    enrolledCount={enrolledCount(course.id)}
                    compact={endMinutes - startMinutes < 75 || lanes > 1}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
