import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimetableStore } from '../store/timetableStore';
import { REQUIRE_SIGN_IN } from '../lib/supabase';
import {
  Sparkles,
  Undo2,
  Database,
  Search,
  BookOpen,
  GraduationCap,
  Plus,
  RotateCcw,
  DoorOpen,
  ShieldCheck,
  Cloud,
  CloudOff,
  Printer,
  CalendarX,
} from 'lucide-react';
import { scheduledMinutesBySection } from '../lib/courseLoad';

export const Header: React.FC = () => {
  const {
    allocations,
    rooms,
    students,
    courses,
    allocationHistory,
    undoLastReschedule,
    openFlexibleModal,
    openVacantRoomsModal,
    openRescheduleReview,
    openDataManager,
    openPrintModal,
    openUnscheduled,
    openCoordinatorModal,
    authEmail,
    syncStatus,
    canEdit,
    pendingChanges,
  } = useTimetableStore(
    useShallow((s) => ({
      allocations: s.allocations,
      rooms: s.rooms,
      students: s.students,
      courses: s.courses,
      allocationHistory: s.allocationHistory,
      undoLastReschedule: s.undoLastReschedule,
      openFlexibleModal: s.openFlexibleModal,
      openVacantRoomsModal: s.openVacantRoomsModal,
      openRescheduleReview: s.openRescheduleReview,
      openDataManager: s.openDataManager,
      openPrintModal: s.openPrintModal,
      openUnscheduled: s.openUnscheduled,
      openCoordinatorModal: s.openCoordinatorModal,
      authEmail: s.authEmail,
      syncStatus: s.syncStatus,
      canEdit: s.canEdit,
      pendingChanges: s.pendingChanges,
    }))
  );

  const rescheduledCount = allocations.filter((a) => a.isRescheduled).length;
  const canUndo = allocationHistory.length > 0;
  const unscheduledCount = React.useMemo(() => {
    const minutes = scheduledMinutesBySection(allocations);
    return courses.filter((c) => !minutes.has(c.id)).length;
  }, [allocations, courses]);

  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-16 py-2 gap-x-4 gap-y-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/branding/fast-nu-logo.png"
              alt="FAST – National University of Computer and Emerging Sciences"
              className="h-9 sm:h-10 w-auto shrink-0"
            />
            <div className="hidden sm:block pl-3 border-l border-gray-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <h1 className="text-base lg:text-lg font-black tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
                  Make-Up <span className="text-[#29abe2]">Class Scheduler</span>
                </h1>
              </div>
            </div>
          </div>

          {/* Center Stats Badges */}
          <div className="hidden 2xl:flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-xs text-gray-700 dark:text-gray-300 font-medium">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>
                <strong>{allocations.length}</strong> Sessions
              </span>
            </div>

            <button
              onClick={openRescheduleReview}
              title="Click to view and manage weekly rescheduled and makeup classes"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                rescheduledCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/80 shadow-xs animate-pulse'
                  : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 border-transparent'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${rescheduledCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
              <span>
                <strong>{rescheduledCount}</strong> Rescheduled{rescheduledCount > 0 ? ' (Review)' : ''}
              </span>
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-xs text-gray-700 dark:text-gray-300 font-medium">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                <strong>{students.length}</strong> Students Tracked
              </span>
            </div>
          </div>

          {/* Action Buttons: icons only on smaller screens (labels are in the tooltips) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {/* Rescheduled review: the stats badge is hidden below 2xl */}
            <button
              onClick={openRescheduleReview}
              title={`${rescheduledCount} rescheduled – review this week's changes`}
              className={`2xl:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                rescheduledCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/80'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{rescheduledCount}</span>
            </button>
            {/* Undo Button */}
            <button
              onClick={undoLastReschedule}
              disabled={!canUndo}
              title="Undo last reschedule change"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                canUndo
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 cursor-pointer shadow-xs'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-transparent cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              {canUndo && (
                <span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10px] flex items-center justify-center font-bold">
                  {allocationHistory.length}
                </span>
              )}
            </button>

            {/* Vacant Rooms Scanner Button */}
            <button
              onClick={() => openVacantRoomsModal()}
              title="Scan all campus rooms for vacancies"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-all border border-blue-200 dark:border-blue-900"
            >
              <DoorOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden lg:inline">Vacant Rooms</span>
            </button>

            {/* Extra / Makeup Finder Button */}
            <button
              onClick={() => openFlexibleModal()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm hover:shadow-indigo-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Makeup</span>
            </button>

            {/* Unscheduled courses (Req E) */}
            <button
              onClick={openUnscheduled}
              title={`${unscheduledCount} course sections have no class on the timetable`}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-zinc-700"
            >
              <CalendarX className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-bold">{unscheduledCount}</span>
            </button>

            {/* Print room schedules */}
            <button
              onClick={openPrintModal}
              title="Print room schedules to post outside classrooms"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-zinc-700"
            >
              <Printer className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {/* Data Manager Button */}
            <button
              onClick={openDataManager}
              title="Manage Datasets, Import/Export JSON"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-zinc-700"
            >
              <Database className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {/* Coordinator sign-in & database status */}
            {syncStatus !== 'local' && (
              <button
                onClick={openCoordinatorModal}
                title={canEdit ? 'Editing unlocked – database options' : REQUIRE_SIGN_IN ? 'Sign in to change the timetable' : 'Enter the edit PIN to change the timetable'}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  canEdit
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                {syncStatus === 'offline' ? (
                  <CloudOff className="w-3.5 h-3.5 text-red-500" />
                ) : canEdit ? (
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
                )}
                <span className="hidden lg:inline">{canEdit ? 'Editing on' : REQUIRE_SIGN_IN ? 'Sign in' : 'Enter PIN'}</span>
                {pendingChanges > 0 && (
                  <span
                    className="ml-0.5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold"
                    title={`${pendingChanges} change(s) not saved to the database yet – retrying`}
                  >
                    {pendingChanges}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
