import React, { useMemo, useState } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { checkRoomConflict, checkStudentClashes } from '../lib/engine';
import { getAllocationInterval } from '../lib/utils';
import {
  X,
  AlertTriangle,
  ShieldCheck,
  Ban,
  ArrowRight,
  UserX,
  Building2,
  CheckCircle2,
  Calendar,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { STANDARD_TIME_SLOTS } from '../lib/constants';

export const ImpactModal: React.FC = () => {
  const {
    isImpactModalOpen,
    closeImpactModal,
    selectedAllocation,
    selectedCourse,
    targetDay,
    targetSlot,
    targetRoomId,
    targetCustomInterval,
    rooms,
    courses,
    students,
    allocations,
    confirmReschedule,
  } = useTimetableStore();

  const [overrideNote, setOverrideNote] = useState('');
  const [acknowledgedOverride, setAcknowledgedOverride] = useState(false);

  // Target interval
  const targetInterval = useMemo(() => {
    if (targetCustomInterval) return targetCustomInterval;
    if (targetSlot) {
      return {
        startMinutes: targetSlot.startMinutes,
        endMinutes: targetSlot.endMinutes,
        startTime: targetSlot.startTime,
        endTime: targetSlot.endTime,
      };
    }
    return { startMinutes: 510, endMinutes: 590, startTime: '08:30', endTime: '09:50' };
  }, [targetSlot, targetCustomInterval]);

  // Evaluate room conflict
  const roomConflict = useMemo(() => {
    if (!targetDay || !selectedAllocation) return { hasConflict: false };
    return checkRoomConflict(
      targetDay,
      targetInterval,
      targetRoomId,
      allocations,
      courses,
      selectedAllocation.id
    );
  }, [targetDay, targetInterval, targetRoomId, allocations, courses, selectedAllocation]);

  // Evaluate student clashes
  const studentClashes = useMemo(() => {
    if (!targetDay || !selectedAllocation || !selectedCourse) {
      return {
        clashCount: 0,
        clashStudents: [],
        totalEnrolled: 0,
        clashPercentage: 0,
        severity: 'SAFE' as const,
      };
    }
    return checkStudentClashes(
      selectedCourse.id,
      targetDay,
      targetInterval,
      allocations,
      students,
      courses,
      rooms,
      selectedAllocation.id
    );
  }, [targetDay, targetInterval, allocations, students, courses, rooms, selectedAllocation, selectedCourse]);

  if (!isImpactModalOpen || !selectedAllocation || !selectedCourse || !targetDay) {
    return null;
  }

  const currentRoom = rooms.find((r) => r.id === selectedAllocation.roomId);
  const targetRoom = rooms.find((r) => r.id === targetRoomId) || rooms[0];

  const currentInterval = getAllocationInterval(
    selectedAllocation.slotId,
    selectedAllocation.customInterval
  );

  const hasRoomBlock = roomConflict.hasConflict;
  const hasStudentClashes = studentClashes.clashCount > 0;
  const canConfirm = !hasRoomBlock || acknowledgedOverride;

  const handleConfirm = () => {
    if (!canConfirm) return;
    confirmReschedule(overrideNote);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              "What-If" Impact Analysis
            </span>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mt-0.5">
              Reschedule: {selectedCourse.courseCode} ({selectedCourse.section})
            </h3>
          </div>
          <button
            onClick={closeImpactModal}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Comparison Flow Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
            {/* From */}
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Current Slot
              </span>
              <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200 mt-1 text-sm">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                {selectedAllocation.day}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-mono mt-0.5">
                <Clock className="w-3 h-3 text-gray-400" />
                {currentInterval.startTime} - {currentInterval.endTime}
              </div>
              <span className="text-xs text-gray-500 mt-1">
                Room: <strong>{currentRoom?.name}</strong>
              </span>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-1 sm:my-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* To */}
            <div className="flex flex-col sm:items-end">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Proposed Target Slot
              </span>
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mt-1 text-sm">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                {targetDay}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono mt-0.5">
                <Clock className="w-3 h-3 text-blue-400" />
                {targetInterval.startTime} - {targetInterval.endTime}
              </div>
              <span className="text-xs text-gray-500 mt-1">
                Room: <strong>{targetRoom.name}</strong> ({targetRoom.type})
              </span>
            </div>
          </div>

          {/* Section 1: Room Double-Booking Status */}
          <div className="p-4 rounded-xl border transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {roomConflict.hasConflict ? (
                  <Ban className="w-5 h-5 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    Room Booking Status ({targetRoom.name})
                  </h4>
                  <p className="text-xs text-gray-500">
                    Capacity: {targetRoom.capacity} seats • Required for this class: {studentClashes.totalEnrolled} students
                  </p>
                </div>
              </div>

              {roomConflict.hasConflict ? (
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                  Room Occupied
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                  Room Free
                </span>
              )}
            </div>

            {roomConflict.hasConflict && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
                <strong className="block mb-1">Double Booking Conflict Detected!</strong>
                {roomConflict.reason}. Rescheduling to this slot will conflict with another instructor's class.
              </div>
            )}
          </div>

          {/* Section 2: Student Clash Breakdown */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {studentClashes.clashCount === 0 ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                ) : studentClashes.severity === 'MINOR' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    Student Enrollment Conflicts
                  </h4>
                  <p className="text-xs text-gray-500">
                    Cross-referencing {studentClashes.totalEnrolled} enrolled student timetables
                  </p>
                </div>
              </div>

              {studentClashes.clashCount === 0 ? (
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                  0 Clashes (Safe)
                </span>
              ) : (
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                    studentClashes.severity === 'MINOR'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                  }`}
                >
                  {studentClashes.clashCount} Students Impacted ({studentClashes.clashPercentage}%)
                </span>
              )}
            </div>

            {studentClashes.clashCount === 0 ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200">
                ✅ <strong>Zero student clashes!</strong> All {studentClashes.totalEnrolled} registered students in {selectedCourse.courseCode} are completely free during {targetDay} {targetInterval.startTime} - {targetInterval.endTime}.
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  The following students have another compulsory or elective class scheduled at this exact time:
                </p>

                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded-lg divide-y divide-gray-100 dark:divide-zinc-800">
                  {studentClashes.clashStudents.map((clash, i) => (
                    <div
                      key={`${clash.studentId}-${i}`}
                      className="p-2.5 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-gray-600 dark:text-gray-300">
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {clash.studentName}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            ID: {clash.studentId}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          {clash.conflictingCourseCode}
                        </span>
                        <span className="text-[11px] text-gray-500 block truncate max-w-[200px]">
                          {clash.conflictingCourseTitle} ({clash.conflictingRoomName})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Override Note / Optional memo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Administrative Note (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Makeup lecture requested by instructor; Approved by HoD"
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Room Conflict Override Checkbox */}
          {hasRoomBlock && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800">
              <label className="flex items-start gap-2 cursor-pointer text-xs font-semibold text-amber-900 dark:text-amber-200">
                <input
                  type="checkbox"
                  checked={acknowledgedOverride}
                  onChange={(e) => setAcknowledgedOverride(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  I understand the target room is currently booked, and I wish to force-override this schedule change.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 flex items-center justify-between">
          <button
            onClick={closeImpactModal}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel / Choose Another Slot
          </button>

          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
              !canConfirm
                ? 'bg-gray-300 dark:bg-zinc-800 text-gray-500 cursor-not-allowed'
                : hasStudentClashes
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {hasStudentClashes ? 'Confirm Despite Clashes' : 'Confirm & Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
