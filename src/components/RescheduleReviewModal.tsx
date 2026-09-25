import React, { useState, useMemo } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { getAllocationInterval } from '../lib/utils';
import { STANDARD_TIME_SLOTS } from '../lib/constants';
import {
  X,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Clock,
  Building2,
  Users,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Layers,
  Undo2,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';

export const RescheduleReviewModal: React.FC = () => {
  const {
    isRescheduleReviewOpen,
    closeRescheduleReview,
    allocations,
    courses,
    rooms,
    students,
    revertAllocationToOriginal,
    keepAllocationForWeek,
    revertAllRescheduled,
    keepAllRescheduled,
    initiateReschedule,
  } = useTimetableStore();

  const [confirmRevertAll, setConfirmRevertAll] = useState(false);

  // All currently rescheduled or makeup allocations
  const rescheduledAllocations = useMemo(() => {
    return allocations.filter((a) => a.isRescheduled);
  }, [allocations]);

  if (!isRescheduleReviewOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Weekly Rescheduled Classes & Makeup Review
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {rescheduledAllocations.length} Active Modification{rescheduledAllocations.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Review, confirm, or restore class slots modified during the current academic week.
              </p>
            </div>
          </div>

          <button
            onClick={closeRescheduleReview}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bulk Action Controls Bar */}
        {rescheduledAllocations.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Manage all {rescheduledAllocations.length} weekly changes simultaneously:
            </span>

            <div className="flex items-center gap-2">
              {confirmRevertAll ? (
                <div className="flex items-center gap-2 bg-rose-100 dark:bg-rose-950/80 p-1.5 rounded-lg border border-rose-300 dark:border-rose-800 animate-in fade-in">
                  <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                    Revert all {rescheduledAllocations.length} classes?
                  </span>
                  <button
                    onClick={() => {
                      revertAllRescheduled();
                      setConfirmRevertAll(false);
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                  >
                    Yes, Revert All
                  </button>
                  <button
                    onClick={() => setConfirmRevertAll(false)}
                    className="px-2 py-1 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-medium text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRevertAll(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800 transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert All Changes</span>
                </button>
              )}

              <button
                onClick={keepAllRescheduled}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Keep All for Current Week</span>
              </button>
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {rescheduledAllocations.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                No Active Rescheduled Classes
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                All classes are currently operating on the official university timetable baseline. When you reschedule any class or allocate a makeup slot, it will appear here for review.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rescheduledAllocations.map((alloc) => {
                const course = courses.find((c) => c.id === alloc.courseSectionId);
                const room = rooms.find((r) => r.id === alloc.roomId);
                const enrolledCount = students.filter((s) =>
                  s.enrolledSectionIds.includes(alloc.courseSectionId)
                ).length;

                const currentSlot = STANDARD_TIME_SLOTS.find((s) => s.id === alloc.slotId);
                const currentInterval = getAllocationInterval(alloc.slotId, alloc.customInterval);

                const hasOriginal = !!alloc.rescheduledFrom;
                const originalRoom = hasOriginal
                  ? rooms.find((r) => r.id === alloc.rescheduledFrom?.roomId)
                  : null;
                const originalSlot = hasOriginal
                  ? STANDARD_TIME_SLOTS.find((s) => s.id === alloc.rescheduledFrom?.slotId)
                  : null;
                const originalInterval = hasOriginal
                  ? getAllocationInterval(alloc.rescheduledFrom!.slotId, alloc.rescheduledFrom!.customInterval)
                  : null;

                return (
                  <div
                    key={alloc.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-blue-300 dark:hover:border-blue-700"
                  >
                    {/* Course Metadata */}
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {course?.section || 'Section'}
                        </span>
                        <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                          {course?.courseCode || alloc.courseSectionId}
                        </h4>
                        <span className="text-xs text-gray-500 font-medium truncate max-w-[200px]">
                          {course?.courseTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                        <span>Instructor: <strong>{course?.instructor || 'Faculty'}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          {enrolledCount} enrolled
                        </span>
                        {alloc.note && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 dark:text-amber-300 italic text-[11px]">
                              &ldquo;{alloc.note}&rdquo;
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Schedule Comparison Box */}
                    <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs shrink-0">
                      {hasOriginal ? (
                        <>
                          {/* Original Slot */}
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-gray-400">
                              Original
                            </span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                              {alloc.rescheduledFrom?.day}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              {originalInterval?.startTime}-{originalInterval?.endTime} ({originalRoom?.name || alloc.rescheduledFrom?.roomId})
                            </span>
                          </div>

                          <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold pr-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>New Makeup Session</span>
                        </div>
                      )}

                      {/* Current Slot */}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                          Current Slot
                        </span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                          {alloc.day}
                        </span>
                        <span className="text-[11px] text-gray-700 dark:text-gray-300 font-mono font-medium">
                          {currentInterval.startTime}-{currentInterval.endTime} ({room?.name || alloc.roomId})
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {/* Revert Button */}
                      <button
                        onClick={() => revertAllocationToOriginal(alloc.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-700 dark:text-gray-200 hover:text-rose-700 dark:hover:text-rose-300 font-bold text-xs border border-gray-200 dark:border-zinc-600 transition-colors shadow-2xs"
                        title={hasOriginal ? "Revert back to original timetable slot" : "Cancel and delete this makeup session"}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{hasOriginal ? 'Revert' : 'Remove'}</span>
                      </button>

                      {/* Keep Button */}
                      <button
                        onClick={() => keepAllocationForWeek(alloc.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
                        title="Confirm and lock this session for the current week"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Keep for Week</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
