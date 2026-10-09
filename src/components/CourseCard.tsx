import React from 'react';
import { Allocation, CourseSection, Room } from '../types/timetable';
import { useTimetableStore } from '../store/timetableStore';
import { ArrowRightLeft, Users, Sparkles, MapPin, Clock } from 'lucide-react';
import { STANDARD_TIME_SLOTS } from '../lib/constants';

interface CourseCardProps {
  allocation: Allocation;
  course: CourseSection;
  room: Room;
  enrolledCount: number;
}

export const CourseCard: React.FC<CourseCardProps> = React.memo(function CourseCard({
  allocation,
  course,
  room,
  enrolledCount,
}) {
  const initiateReschedule = useTimetableStore((s) => s.initiateReschedule);
  const isSelected = useTimetableStore((s) => s.selectedAllocation?.id === allocation.id);

  const standardSlot = STANDARD_TIME_SLOTS.find(s => s.id === allocation.slotId);
  const timeDisplay = standardSlot
    ? `${standardSlot.startTime} - ${standardSlot.endTime}`
    : allocation.customInterval
    ? `${allocation.customInterval.startTime} - ${allocation.customInterval.endTime}`
    : '';

  const isLabSlot =
    allocation.slotId.startsWith('lab') ||
    ['slot-9', 'slot-10', 'slot-11', 'slot-12'].includes(allocation.slotId) ||
    room.type === 'Lab';

  return (
    <div
      onClick={() => initiateReschedule(allocation)}
      className={`group relative flex flex-col justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${course.color.bg} ${course.color.border} ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02] border-blue-500'
          : 'hover:border-blue-400 hover:scale-[1.01]'
      }`}
    >
      {/* Top row: Badges */}
      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${course.color.badge}`}
          >
            {course.section}
          </span>
          {isLabSlot && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              Lab • 2h 45m
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

      {/* Course Code & Title */}
      <div className="mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
            {course.courseCode}
          </span>
          <span className="text-[11px] text-gray-500 font-medium truncate">
            {course.creditHours} Cr
          </span>
        </div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 line-clamp-2 leading-tight">
          {course.courseTitle}
        </p>
      </div>

      {/* Meta Footer */}
      <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-col gap-1 text-[11px] text-gray-600 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-gray-800 dark:text-gray-200 max-w-[130px]">
            {course.instructor}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
            <Users className="w-2.5 h-2.5" />
            {enrolledCount}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-2.5 h-2.5 text-gray-400" />
            {room.name}
          </span>
          {allocation.slotId === 'custom' && (
            <span className="flex items-center gap-1 font-mono text-purple-700 dark:text-purple-300">
              <Clock className="w-2.5 h-2.5" />
              {timeDisplay}
            </span>
          )}
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
