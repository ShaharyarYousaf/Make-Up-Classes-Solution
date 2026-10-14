import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, ChevronDown, PencilLine } from 'lucide-react';
import { useTimetableStore } from '../store/timetableStore';
import { DAYS_OF_WEEK } from '../lib/constants';
import { checkInstructorConflict, checkRoomConflict, checkStudentClashes } from '../lib/engine';
import { formatDuration, parseClockTime } from '../lib/timeline';
import { getAllocationInterval } from '../lib/utils';
import { Allocation, DayOfWeek } from '../types/timetable';
import { Combobox } from './Combobox';

const EARLIEST = 7 * 60;
const LATEST = 21 * 60;

/**
 * Correct a class's day, exact start/end time and room in place (e.g. SS1026 runs 13:00–14:45, not Slot 4).
 * This fixes the timetable itself, so the class is not marked "Rescheduled".
 */
export const EditClassTime: React.FC<{ allocation: Allocation }> = ({ allocation }) => {
  const { courses, rooms, students, allocations, updateAllocationTime } = useTimetableStore(
    useShallow((s) => ({
      courses: s.courses,
      rooms: s.rooms,
      students: s.students,
      allocations: s.allocations,
      updateAllocationTime: s.updateAllocationTime,
    }))
  );
  const current = getAllocationInterval(allocation.slotId, allocation.customInterval);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<DayOfWeek>(allocation.day);
  const [start, setStart] = useState(current.startTime);
  const [end, setEnd] = useState(current.endTime);
  const [roomId, setRoomId] = useState(allocation.roomId);

  // A different class opened in the panel: start from its values
  useEffect(() => {
    const i = getAllocationInterval(allocation.slotId, allocation.customInterval);
    setDay(allocation.day);
    setStart(i.startTime);
    setEnd(i.endTime);
    setRoomId(allocation.roomId);
  }, [allocation]);

  const startMinutes = parseClockTime(start);
  const endMinutes = parseClockTime(end);
  const error =
    startMinutes === undefined || endMinutes === undefined
      ? 'Enter a start and end time.'
      : endMinutes <= startMinutes
      ? 'End time must be after the start time.'
      : startMinutes < EARLIEST || endMinutes > LATEST
      ? 'Times must be between 07:00 and 21:00.'
      : startMinutes % 5 !== 0 || endMinutes % 5 !== 0
      ? 'Use 5-minute steps (e.g. 13:00, 14:45).'
      : null;
  const unchanged =
    day === allocation.day && roomId === allocation.roomId && startMinutes === current.startMinutes && endMinutes === current.endMinutes;

  const checks = useMemo(() => {
    if (!open || error || startMinutes === undefined || endMinutes === undefined) return null;
    const interval = { startMinutes, endMinutes };
    return {
      room: checkRoomConflict(day, interval, roomId, allocations, courses, allocation.id),
      teacher: checkInstructorConflict(allocation.courseSectionId, day, interval, allocations, courses, rooms, allocation.id),
      students: checkStudentClashes(allocation.courseSectionId, day, interval, allocations, students, courses, rooms, allocation.id),
    };
  }, [open, error, startMinutes, endMinutes, day, roomId, allocations, courses, rooms, students, allocation]);

  const roomOptions = useMemo(
    () => rooms.map((r) => ({ value: r.id, label: r.name, detail: `${r.type}${r.capacity ? ` · ${r.capacity} seats` : ''}`, keywords: r.building })),
    [rooms]
  );

  const inputClass =
    'px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const ok = (good: boolean, text: string) => (
    <span className={`flex items-center gap-1 ${good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
      {good ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {text}
    </span>
  );

  return (
    <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 sm:px-5 py-2.5 flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
      >
        <PencilLine className="w-4 h-4 text-blue-600" />
        Edit time &amp; room
        <span className="font-normal text-gray-500">– correct the timetable (e.g. a class that runs 13:00–14:45)</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-bold text-gray-500">Day</span>
              <select value={day} onChange={(e) => setDay(e.target.value as DayOfWeek)} className={inputClass}>
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-gray-500">Start</span>
              <input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-gray-500">End</span>
              <input type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-gray-500">Room</span>
              <Combobox options={roomOptions} value={roomId} onChange={setRoomId} ariaLabel="Room" inputClassName={inputClass} />
            </div>
          </div>

          {error ? (
            <p className="text-red-600 dark:text-red-400">{error}</p>
          ) : (
            checks && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-gray-600 dark:text-gray-400">
                  {formatDuration(endMinutes! - startMinutes!)} on {day}:
                </span>
                {ok(!checks.room.hasConflict, checks.room.hasConflict ? `Room taken (${checks.room.conflictingCourse?.courseCode || checks.room.conflictingAllocation?.note || 'another booking'})` : 'Room free')}
                {ok(!checks.teacher.hasConflict, checks.teacher.hasConflict ? `Teacher busy (${checks.teacher.conflicts[0]?.course.courseCode})` : 'Teacher free')}
                {ok(
                  checks.students.clashCount === 0,
                  checks.students.clashCount === 0 ? 'No student clashes' : `${checks.students.clashCount} student clash${checks.students.clashCount === 1 ? '' : 'es'}`
                )}
              </div>
            )
          )}

          <div className="flex items-center gap-2">
            <button
              disabled={!!error || unchanged}
              onClick={() => {
                const warn =
                  checks && (checks.room.hasConflict || checks.teacher.hasConflict || checks.students.clashCount > 0)
                    ? window.confirm('This time has clashes (see above). Save it anyway?')
                    : true;
                if (warn) updateAllocationTime(allocation.id, { day, roomId, startMinutes: startMinutes!, endMinutes: endMinutes! });
              }}
              className="px-4 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white"
            >
              Save time
            </button>
            <span className="text-[11px] text-gray-500">
              Saved for everyone as a correction (not marked “Rescheduled”). Undo is available.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
