import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimetableStore } from '../store/timetableStore';
import { findFlexibleSlots } from '../lib/engine';
import { DAYS_OF_WEEK } from '../lib/constants';
import {
  X,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Calendar,
  Search,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { DayOfWeek, RoomType } from '../types/timetable';

export const FlexibleSlotFinder: React.FC = () => {
  const {
    isFlexibleModalOpen,
    closeFlexibleModal,
    courses,
    rooms,
    students,
    allocations,
    createFlexibleAllocation,
  } = useTimetableStore(
    useShallow((s) => ({
      isFlexibleModalOpen: s.isFlexibleModalOpen,
      closeFlexibleModal: s.closeFlexibleModal,
      courses: s.courses,
      rooms: s.rooms,
      students: s.students,
      allocations: s.allocations,
      createFlexibleAllocation: s.createFlexibleAllocation,
    }))
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id || ''
  );
  const [duration, setDuration] = useState<number>(120); // default 2 hours for lab/seminar
  const [selectedDayFilter, setSelectedDayFilter] = useState<DayOfWeek | 'ALL'>('ALL');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('ALL');
  const [safeOnly, setSafeOnly] = useState<boolean>(true);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  // Run scanner (only while the modal is open – this component stays mounted when closed)
  const flexibleSlots = useMemo(() => {
    if (!isFlexibleModalOpen || !selectedCourse) return [];
    return findFlexibleSlots(
      selectedCourse.id,
      duration,
      allocations,
      students,
      courses,
      rooms,
      selectedDayFilter === 'ALL' ? undefined : [selectedDayFilter],
      selectedRoomType === 'ALL' ? undefined : selectedRoomType
    );
  }, [
    isFlexibleModalOpen,
    selectedCourse,
    duration,
    allocations,
    students,
    courses,
    rooms,
    selectedDayFilter,
    selectedRoomType,
  ]);

  const filteredSlots = useMemo(() => {
    if (!safeOnly) return flexibleSlots;
    return flexibleSlots.filter((s) => s.status === 'SAFE');
  }, [flexibleSlots, safeOnly]);

  if (!isFlexibleModalOpen) return null;

  const handleBookSlot = (slot: (typeof flexibleSlots)[0]) => {
    createFlexibleAllocation(
      selectedCourse.id,
      slot.day,
      slot.roomId,
      {
        startTime: slot.startTime,
        endTime: slot.endTime,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      },
      `Makeup Session (${duration} mins)`
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/70 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              Flexible / Extra Slot Allocator
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
              Scan All Rooms for Free Makeup & Seminar Windows
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Automatically discovers continuous room gaps with zero student clashes across the 6-day week.
            </p>
          </div>
          <button
            onClick={closeFlexibleModal}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Course selector */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Course Section
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              aria-label="Course Section"
              className="w-full px-2.5 py-1.5 text-xs font-medium bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} ({c.section})
                </option>
              ))}
            </select>
          </div>

          {/* Duration selector */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Session Duration
            </label>
            <div className="flex rounded-lg border border-gray-300 dark:border-zinc-700 p-0.5 bg-gray-50 dark:bg-zinc-800">
              {[
                { label: '60m (1h)', val: 60 },
                { label: '80m', val: 80 },
                { label: '120m (2h)', val: 120 },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setDuration(item.val)}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                    duration === item.val
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day preference */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Preferred Day
            </label>
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value as any)}
              aria-label="Preferred Day"
              className="w-full px-2.5 py-1.5 text-xs font-medium bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Any Day (Mon - Sat)</option>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Room Type */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Room Type
            </label>
            <select
              value={selectedRoomType}
              onChange={(e) => setSelectedRoomType(e.target.value)}
              aria-label="Room Type"
              className="w-full px-2.5 py-1.5 text-xs font-medium bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Room Types</option>
              <option value="Lecture">Lecture Halls</option>
              <option value="Lab">Computer & AI Labs</option>
              <option value="Smart Classroom">Smart Classrooms</option>
              <option value="Seminar Hall">Seminar Halls</option>
            </select>
          </div>
        </div>

        {/* Results Bar */}
        <div className="px-5 py-2.5 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Found <strong>{filteredSlots.length}</strong> candidate windows for {selectedCourse.courseCode}
          </span>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={safeOnly}
              onChange={(e) => setSafeOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Only Safe Slots (0 Student Clashes)
            </span>
          </label>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {filteredSlots.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="font-semibold">No matching continuous windows found.</p>
              <p className="text-xs">Try selecting a different duration or enabling all days.</p>
            </div>
          ) : (
            filteredSlots.slice(0, 30).map((slot, index) => (
              <div
                key={`${slot.roomId}-${slot.day}-${slot.startMinutes}-${index}`}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  slot.status === 'SAFE'
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400'
                    : slot.instructorConflict
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 opacity-80'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                      slot.status === 'SAFE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                    }`}
                  >
                    {slot.durationMinutes}m
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                        {slot.day}
                      </span>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {slot.roomName}
                      </span>
                      <span>•</span>
                      <span>{slot.roomType}</span>
                      <span>•</span>
                      <span>Capacity: {slot.capacity} seats</span>
                    </div>
                    {slot.suitability.warnings.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {slot.suitability.warnings.join(' • ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  {slot.instructorConflict ? (
                    <span
                      title={slot.instructorConflict.reason}
                      className="flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2.5 py-1 rounded-md"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Teacher Busy ({slot.instructorConflict.conflicts[0].course.courseCode})
                    </span>
                  ) : slot.status === 'SAFE' ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      0 Student Clashes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      {slot.studentClashes.clashCount} Clashes ({slot.studentClashes.clashPercentage}%)
                    </span>
                  )}

                  <button
                    onClick={() => handleBookSlot(slot)}
                    disabled={!!slot.instructorConflict}
                    title={slot.instructorConflict ? 'The instructor is already teaching at this time' : undefined}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-zinc-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-sm hover:shadow-md"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Book Slot
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
