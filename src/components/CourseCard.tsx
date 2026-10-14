import React from 'react';
import { Allocation, CourseSection, Room } from '../types/timetable';
import { useTimetableStore } from '../store/timetableStore';
import { ArrowRightLeft, Users, Sparkles, MapPin, Clock } from 'lucide-react';
import { getAllocationInterval } from '../lib/utils';

interface CourseCardProps {
  allocation: Allocation;
  course: CourseSection;
  room: Room;
  enrolledCount: number;
  /** Short or side-by-side blocks on the timeline: only the essentials */
  compact?: boolean;
  /** Name the room on compact tiles (week view mixes rooms) */
  showRoom?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = React.memo(function CourseCard({
  allocation,
  course,
  room,
  enrolledCount,
  compact = false,
  showRoom = false,
}) {
  const initiateReschedule = useTimetableStore((s) => s.initiateReschedule);
  const isSelected = useTimetableStore((s) => s.selectedAllocation?.id === allocation.id);

  const interval = getAllocationInterval(allocation.slotId, allocation.customInterval);
  const timeDisplay = `${interval.startTime} - ${interval.endTime}`;
  const isCustomTime = !!allocation.customInterval;

  const isLabSlot = allocation.slotId.startsWith('lab') || room.type === 'Lab';

  if (compact) {
    return (
      <div
        onClick={() => initiateReschedule(allocation)}
        title={`${course.courseCode} ${course.courseTitle} (${course.section}) • ${timeDisplay} • ${course.instructor} • click to reschedule`}
        className={`h-full overflow-hidden flex flex-col gap-0.5 px-2 py-1 rounded-lg border cursor-pointer shadow-sm hover:shadow-md hover:border-blue-400 transition-all ${course.color.bg} ${course.color.border} ${
          isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''
        }`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] font-extrabold text-gray-900 dark:text-white truncate">{course.courseCode}</span>
          <span className={`text-[9px] font-bold px-1 rounded ${course.color.badge} truncate`}>{course.section}</span>
          {allocation.isRescheduled && <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
        </div>
        {/* As much as fits: title, teacher, room + time, each on one line; extra lines are cut by the block */}
        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate leading-tight">
          {course.courseTitle}
        </span>
        <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate leading-tight flex items-center gap-1">
          <span className="truncate">{course.instructor}</span>
          <span className="flex items-center gap-0.5 shrink-0">
            <Users className="w-2.5 h-2.5" />
            {enrolledCount}
          </span>
        </span>
        <span className="text-[10px] leading-tight flex items-center justify-between gap-1 min-w-0">
          <span className="flex items-center gap-0.5 min-w-0 text-gray-600 dark:text-gray-400">
            <MapPin className="w-2.5 h-2.5 shrink-0 text-gray-400" />
            <span className="truncate">{room.name}</span>
          </span>
          <span
            className={`shrink-0 whitespace-nowrap font-mono ${
              isCustomTime ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {interval.startTime}–{interval.endTime}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => initiateReschedule(allocation)}
      title={`${course.courseCode} ${course.courseTitle} (${course.section}) • ${course.instructor} • ${timeDisplay}`}
      className={`group relative h-full overflow-hidden flex flex-col gap-1 px-2.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${course.color.bg} ${course.color.border} ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02] border-blue-500'
          : 'hover:border-blue-400 hover:scale-[1.01]'
      }`}
    >
      {/* Top row: Badges */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${course.color.badge}`}
          >
            {course.section}
          </span>
          {isLabSlot && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              Lab
            </span>
          )}
          {showRoom && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 dark:bg-black/30 text-gray-800 dark:text-gray-200">
              <MapPin className="w-2.5 h-2.5 text-gray-500" />
              {room.name}
            </span>
          )}
        </div>

        {allocation.isRescheduled && (
          <span
            title={`Originally scheduled: ${allocation.rescheduledFrom?.day || ''} (${allocation.rescheduledFrom?.slotId || ''})`}
            className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700"
          >
            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
            Rescheduled
          </span>
        )}
      </div>

      {/* Course Code & Title: one title line so the footer always fits an 80-minute block */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
            {course.courseCode}
          </span>
          <span className="text-[11px] text-gray-500 font-medium truncate">
            {course.creditHours} Cr
          </span>
        </div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate leading-tight">
          {course.courseTitle}
        </p>
      </div>

      {/* Meta Footer */}
      <div className="mt-auto pt-1 border-t border-black/5 dark:border-white/10 flex flex-col gap-0.5 text-[11px] text-gray-600 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-gray-800 dark:text-gray-200 max-w-[130px]">
            {course.instructor}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
            <Users className="w-2.5 h-2.5" />
            {enrolledCount}
          </span>
        </div>

        {/* One line: the room gives way (truncates) so the time never wraps */}
        <div className="flex items-center justify-between gap-1 text-[10px] text-gray-500 min-w-0">
          <span className="flex items-center gap-0.5 min-w-0">
            <MapPin className="w-2.5 h-2.5 shrink-0 text-gray-400" />
            <span className="truncate">{room.name}</span>
          </span>
          <span
            className={`flex items-center gap-0.5 shrink-0 whitespace-nowrap font-mono ${isCustomTime ? 'font-bold text-purple-700 dark:text-purple-300' : ''}`}
            title={isCustomTime ? 'Exact time – differs from the standard slot' : undefined}
          >
            <Clock className="w-2.5 h-2.5" />
            {interval.startTime}–{interval.endTime}
          </span>
        </div>
      </div>

      {/* Quick Hover Reschedule Button */}
      <div className="absolute inset-0 rounded-xl bg-blue-600/90 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 backdrop-blur-sm shadow-inner">
        <ArrowRightLeft className="w-5 h-5 text-white animate-pulse" />
        <span className="text-xs font-bold tracking-wide">Reschedule Class</span>
        <span className="text-[10px] text-blue-100">Click to find conflict-free slots</span>
      </div>
    </div>
  );
});
