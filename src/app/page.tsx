'use client';

import React from 'react';
import { Header } from '../components/Header';
import { TimetableGrid } from '../components/TimetableGrid';
import { RescheduleDrawer } from '../components/RescheduleDrawer';
import { ImpactModal } from '../components/ImpactModal';
import { FlexibleSlotFinder } from '../components/FlexibleSlotFinder';
import { DataManagerModal } from '../components/DataManagerModal';
import { VacantRoomsModal } from '../components/VacantRoomsModal';
import { RescheduleReviewModal } from '../components/RescheduleReviewModal';
import { QuickRescheduleBar } from '../components/QuickRescheduleBar';
import { Toast } from '../components/Toast';
import { useShallow } from 'zustand/react/shallow';
import { useTimetableStore } from '../store/timetableStore';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Zap,
  BookOpen,
  Calendar,
  Layers,
} from 'lucide-react';

export default function Home() {
  const {
    allocations,
    courses,
    rooms,
    students,
    initiateReschedule,
    openFlexibleModal,
    setSelectedRoomId,
    setSelectedDay,
    setViewMode,
  } = useTimetableStore(
    useShallow((s) => ({
      allocations: s.allocations,
      courses: s.courses,
      rooms: s.rooms,
      students: s.students,
      initiateReschedule: s.initiateReschedule,
      openFlexibleModal: s.openFlexibleModal,
      setSelectedRoomId: s.setSelectedRoomId,
      setSelectedDay: s.setSelectedDay,
      setViewMode: s.setViewMode,
    }))
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950">
      {/* Top Navbar */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-5">
        {/* Quick Reschedule & Feature Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col gap-5">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col gap-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-1 border border-blue-400/30 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Intelligent Clash Resolution Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
              University Timetable Rescheduler & Room Optimizer
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Select any course and section below to inspect <strong>Vacant Rooms</strong>, detect <strong>Cross-Enrollment Clashes</strong>, and reschedule class slots across the 6-day academic schedule.
            </p>
          </div>

          {/* Interactive Quick Reschedule & Vacancy Finder Bar */}
          <div className="relative z-10">
            <QuickRescheduleBar />
          </div>

          {/* Quick Engine Feature Pills */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                🟢
              </div>
              <span>
                <strong>Safe Slots:</strong> 0 student clashes & room free
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                🟡
              </div>
              <span>
                <strong>Minor Clashes:</strong> 1-3 cross-enrolled students
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                🔴
              </div>
              <span>
                <strong>Blocked:</strong> Room occupied or major clash
              </span>
            </div>
          </div>
        </div>

        {/* Timetable Master Grid */}
        <TimetableGrid />
      </main>

      {/* Floating Modals & Drawers */}
      <RescheduleDrawer />
      <ImpactModal />
      <FlexibleSlotFinder />
      <VacantRoomsModal />
      <RescheduleReviewModal />
      <DataManagerModal />
      <Toast />

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-zinc-800 py-4 text-center text-xs text-gray-500 dark:text-zinc-500 bg-white dark:bg-zinc-900">
        <p>
          UniSchedule Pro • Academic Rescheduling & Conflict Resolution System • FAST-NUCES Dataset
        </p>
      </footer>
    </div>
  );
}
