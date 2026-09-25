import React, { useMemo, useState } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from '../lib/constants';
import {
  getBestSlotsAcrossAllRooms,
  getSlotRecommendationsForRoom,
} from '../lib/engine';
import {
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Building2,
  Users,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { DayOfWeek, SlotRecommendation } from '../types/timetable';

export const RescheduleDrawer: React.FC = () => {
  const {
    isRescheduleDrawerOpen,
    closeRescheduleDrawer,
    selectedAllocation,
    selectedCourse,
    rooms,
    courses,
    students,
    allocations,
    targetRoomId,
    setTargetRoomId,
    selectTargetSlot,
  } = useTimetableStore();

  const [activeTab, setActiveTab] = useState<'current-room' | 'all-rooms'>('current-room');
  const [filterSafeOnly, setFilterSafeOnly] = useState<boolean>(false);
  const [selectedFilterDay, setSelectedFilterDay] = useState<DayOfWeek | 'ALL'>('ALL');

  // Compute recommendations for the currently selected room
  const roomRecommendations = useMemo(() => {
    if (!selectedAllocation || !selectedCourse) return [];
    return getSlotRecommendationsForRoom(
      selectedCourse.id,
      targetRoomId,
      allocations,
      students,
      courses,
      rooms,
      selectedAllocation.id
    );
  }, [selectedAllocation, selectedCourse, targetRoomId, allocations, students, courses, rooms]);

  // Compute best slots across ALL campus rooms
  const allRoomsRecommendations = useMemo(() => {
    if (!selectedAllocation || !selectedCourse) return [];
    return getBestSlotsAcrossAllRooms(
      selectedCourse.id,
      allocations,
      students,
      courses,
      rooms,
      selectedAllocation.id,
      selectedFilterDay === 'ALL' ? undefined : selectedFilterDay
    );
  }, [selectedAllocation, selectedCourse, allocations, students, courses, rooms, selectedFilterDay]);

  if (!isRescheduleDrawerOpen || !selectedAllocation || !selectedCourse) {
    return null;
  }

  const currentRoom = rooms.find((r) => r.id === selectedAllocation.roomId);
  const targetRoom = rooms.find((r) => r.id === targetRoomId) || rooms[0];
  const enrolledCount = students.filter((s) =>
    s.enrolledSectionIds.includes(selectedCourse.id)
  ).length;

  const currentStandardSlot = STANDARD_TIME_SLOTS.find(
    (s) => s.id === selectedAllocation.slotId
  );

  // Summary counts for current room
  const safeCount = roomRecommendations.filter((r) => r.status === 'SAFE').length;
  const minorCount = roomRecommendations.filter((r) => r.status === 'MINOR_CLASH').length;
  const blockedCount = roomRecommendations.filter((r) => r.status === 'BLOCKED').length;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300">
        {/* Top Header */}
        <div className="p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900">
                <Sparkles className="w-3.5 h-3.5" />
                Reschedule Assistant & Slot Finder
              </span>
              <span className="text-xs text-gray-500 font-medium">
                Live Conflict Engine Active
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-baseline gap-2">
              <span>{selectedCourse.courseCode}</span>
              <span className="text-sm font-normal text-gray-600 dark:text-gray-300">
                {selectedCourse.courseTitle}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                {selectedCourse.section}
              </span>
            </h2>

            {/* Current details badge */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
              <span className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-gray-200 dark:border-zinc-700">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Current: <strong className="text-gray-800 dark:text-gray-200">{selectedAllocation.day}</strong> ({currentStandardSlot?.startTime || '08:30'} - {currentStandardSlot?.endTime || '09:50'})
              </span>
              <span className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-gray-200 dark:border-zinc-700">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                Room: <strong className="text-gray-800 dark:text-gray-200">{currentRoom?.name}</strong>
              </span>
              <span className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-gray-200 dark:border-zinc-700">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Enrolled: <strong className="text-gray-800 dark:text-gray-200">{enrolledCount} students</strong>
              </span>
            </div>
          </div>

          <button
            onClick={closeRescheduleDrawer}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Control Sub-bar */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
          {/* Target Room Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-gray-500" />
              Target Room:
            </span>
            <select
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              aria-label="Target Room"
              className="text-xs font-semibold bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.type} • {room.capacity} seats)
                </option>
              ))}
            </select>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <strong>{safeCount}</strong> Safe Slots (0 Clashes)
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              <strong>{minorCount}</strong> Minor Clashes
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              <strong>{blockedCount}</strong> Blocked
            </div>
          </div>

          {/* Filter toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300 select-none">
            <input
              type="checkbox"
              checked={filterSafeOnly}
              onChange={(e) => setFilterSafeOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span>Show Only Safe Slots (🟢)</span>
          </label>
        </div>

        {/* View Switch Tabs */}
        <div className="px-5 pt-3 pb-0 flex items-center gap-4 border-b border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('current-room')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'current-room'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Recommendation Matrix ({targetRoom.name})
          </button>
          <button
            onClick={() => setActiveTab('all-rooms')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'all-rooms'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Best Global Slots (Across All Rooms)
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'current-room' ? (
            <div>
              {/* Matrix Legend / Help */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200 dark:border-zinc-700/60 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-semibold text-gray-800 dark:text-white">Status Key:</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-xs"></span>
                    <strong>Green:</strong> Room free & 0 student clashes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-xs"></span>
                    <strong>Yellow:</strong> Room free, 1-3 student clashes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 border border-white shadow-xs"></span>
                    <strong>Red:</strong> Room occupied or &gt;3 clashes
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 hidden sm:inline">
                  Click any cell to open "What-If" impact analysis
                </span>
              </div>

              {/* 6x6 Matrix Grid */}
              <div className="grid grid-cols-[130px_repeat(6,1fr)] gap-2 overflow-x-auto min-w-[700px]">
                {/* Header Row */}
                <div className="p-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100/70 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                  Time Slot
                </div>
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider bg-gray-100/70 dark:bg-zinc-800 rounded-lg"
                  >
                    {day}
                  </div>
                ))}

                {/* Rows for 6 Standard Slots */}
                {STANDARD_TIME_SLOTS.map((slot) => (
                  <React.Fragment key={slot.id}>
                    {/* Time Label */}
                    <div className="p-2 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-center items-center text-center">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Slot {slot.slotNumber}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>

                    {/* Matrix Cells */}
                    {DAYS_OF_WEEK.map((day) => {
                      const rec = roomRecommendations.find(
                        (r) => r.day === day && r.slot.id === slot.id
                      );

                      if (!rec) return <div key={`${day}-${slot.id}`} />;

                      const isCurrent =
                        selectedAllocation.day === day &&
                        selectedAllocation.slotId === slot.id &&
                        selectedAllocation.roomId === targetRoomId;

                      const isHidden = filterSafeOnly && rec.status !== 'SAFE';

                      let style = 'bg-white dark:bg-zinc-900 border-gray-200 text-gray-600 hover:border-gray-400';
                      let badge = null;

                      if (isCurrent) {
                        style = 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-900';
                        badge = (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100">
                            Current Slot
                          </span>
                        );
                      } else if (rec.status === 'SAFE') {
                        style = 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 text-emerald-900 dark:text-emerald-200 hover:scale-[1.03] hover:shadow-md cursor-pointer';
                        badge = (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Safe (0)
                          </span>
                        );
                      } else if (rec.status === 'MINOR_CLASH') {
                        style = 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 hover:scale-[1.03] hover:shadow-md cursor-pointer';
                        badge = (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            {rec.studentClashes.clashCount} Clash{rec.studentClashes.clashCount > 1 ? 'es' : ''}
                          </span>
                        );
                      } else {
                        // BLOCKED
                        style = 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-300 opacity-80 cursor-pointer hover:opacity-100';
                        badge = (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                            <Ban className="w-2.5 h-2.5 text-rose-600" />
                            {rec.roomConflict?.hasConflict ? 'Occupied' : `${rec.studentClashes.clashCount} Clashes`}
                          </span>
                        );
                      }

                      if (isHidden) {
                        return (
                          <div
                            key={`${day}-${slot.id}`}
                            className="p-2 rounded-xl border border-gray-100 dark:border-zinc-800/40 bg-gray-50/20 dark:bg-zinc-900/20 flex items-center justify-center opacity-30"
                          >
                            <span className="text-[10px] text-gray-400">Hidden</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${day}-${slot.id}`}
                          onClick={() => selectTargetSlot(day, slot, targetRoomId)}
                          className={`p-2.5 rounded-xl border transition-all duration-150 flex flex-col justify-between items-center text-center min-h-[85px] ${style}`}
                        >
                          <div className="w-full flex justify-center mb-1">
                            {badge}
                          </div>

                          <span className="text-[11px] font-medium leading-tight line-clamp-2">
                            {rec.roomConflict?.hasConflict
                              ? rec.roomConflict.conflictingCourse?.courseCode || 'Booked'
                              : rec.status === 'SAFE'
                              ? 'Room Available'
                              : `${rec.studentClashes.clashPercentage}% Clash`}
                          </span>

                          <span className="text-[9px] text-gray-400 font-mono mt-1">
                            Click to Inspect
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            /* ALL ROOMS GLOBAL RANKED VIEW */
            <div>
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Ranked by conflict score (Zero student clashes and optimal room capacity first).
                </p>

                {/* Day selector for global search */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-500">Day:</span>
                  {(['ALL', ...DAYS_OF_WEEK] as const).map((day) => (
                    <button
                      key={day}
                      onClick={() => setSelectedFilterDay(day)}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedFilterDay === day
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {day === 'ALL' ? 'Any Day' : day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allRoomsRecommendations
                  .filter((rec) => !filterSafeOnly || rec.status === 'SAFE')
                  .slice(0, 24)
                  .map((rec, idx) => (
                    <div
                      key={`${rec.roomId}-${rec.day}-${rec.slot.id}`}
                      onClick={() => selectTargetSlot(rec.day, rec.slot, rec.roomId)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md flex items-center justify-between ${
                        rec.status === 'SAFE'
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 hover:border-emerald-500'
                          : rec.status === 'MINOR_CLASH'
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 hover:border-amber-500'
                          : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                            {rec.day} • {rec.slot.label.split(' ')[0]} {rec.slot.label.split(' ')[1]}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {rec.slot.startTime} - {rec.slot.endTime}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-semibold">{rec.roomName}</span>
                          <span>•</span>
                          <span>{rec.roomType} ({rec.roomCapacity} seats)</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {rec.status === 'SAFE' ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            0 Clashes (Safe)
                          </span>
                        ) : rec.status === 'MINOR_CLASH' ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {rec.studentClashes.clashCount} Clashes
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md">
                            {rec.studentClashes.clashCount} Clashes
                          </span>
                        )}
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                          Inspect <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
