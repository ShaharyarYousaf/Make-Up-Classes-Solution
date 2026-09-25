import React from 'react';
import { useTimetableStore } from '../store/timetableStore';
import {
  CalendarDays,
  Sparkles,
  Undo2,
  Database,
  Search,
  BookOpen,
  GraduationCap,
  Plus,
  RotateCcw,
  DoorOpen,
} from 'lucide-react';

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
  } = useTimetableStore();

  const rescheduledCount = allocations.filter((a) => a.isRescheduled).length;
  const canUndo = allocationHistory.length > 0;

  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-gray-900 dark:text-white">
                  UniSchedule<span className="text-blue-600 dark:text-blue-400">Pro</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                  Rescheduler & Clash Guard
                </span>
              </div>
              <p className="text-[11px] text-gray-500 hidden md:block">
                Department of Computer Science & AI • University Timetable Matrix
              </p>
            </div>
          </div>

          {/* Center Stats Badges */}
          <div className="hidden lg:flex items-center gap-2.5">
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Undo Button */}
            <button
              onClick={undoLastReschedule}
              disabled={!canUndo}
              title="Undo last reschedule change"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                canUndo
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 cursor-pointer shadow-xs'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border-transparent cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Undo</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-all border border-blue-200 dark:border-blue-900"
            >
              <DoorOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden md:inline">Vacant Rooms</span>
            </button>

            {/* Extra / Makeup Finder Button */}
            <button
              onClick={() => openFlexibleModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm hover:shadow-indigo-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Extra / Makeup Slot</span>
              <span className="sm:hidden">Makeup</span>
            </button>

            {/* Data Manager Button */}
            <button
              onClick={openDataManager}
              title="Manage Datasets, Import/Export JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-zinc-700"
            >
              <Database className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden md:inline">Datasets</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
