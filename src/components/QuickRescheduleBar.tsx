import React, { useState, useMemo } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { getAllocationInterval } from '../lib/utils';
import {
  Sparkles,
  Zap,
  DoorOpen,
  Calendar,
  Users,
  Search,
  ChevronDown,
} from 'lucide-react';

export const QuickRescheduleBar: React.FC = () => {
  const {
    courses,
    allocations,
    initiateReschedule,
    openVacantRoomsModal,
    setSelectedRoomId,
    setViewMode,
  } = useTimetableStore();

  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('AI4015');
  const [selectedSection, setSelectedSection] = useState<string>('BCS-7B');

  // Unique course codes for the quick picker
  const uniqueCourseOptions = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((c) => {
      if (!map.has(c.courseCode)) {
        map.set(c.courseCode, c.courseTitle);
      }
    });
    return Array.from(map.entries()).map(([code, title]) => ({ code, title }));
  }, [courses]);

  // Available sections for the selected course code
  const availableSections = useMemo(() => {
    return courses.filter((c) => c.courseCode === selectedCourseCode);
  }, [courses, selectedCourseCode]);

  // Current course section object
  const currentCourse = useMemo(() => {
    return (
      courses.find(
        (c) => c.courseCode === selectedCourseCode && c.section === selectedSection
      ) || availableSections[0]
    );
  }, [courses, selectedCourseCode, selectedSection, availableSections]);

  // Current allocations for this section
  const sectionAllocations = useMemo(() => {
    if (!currentCourse) return [];
    return allocations.filter((a) => a.courseSectionId === currentCourse.id);
  }, [allocations, currentCourse]);

  const activeAlloc = sectionAllocations[0] || null;

  // Handle course change
  const handleCourseChange = (code: string) => {
    setSelectedCourseCode(code);
    const secs = courses.filter((c) => c.courseCode === code);
    if (secs.length > 0) {
      setSelectedSection(secs[0].section);
    }
  };

  // Launch Reschedule Drawer for this section
  const handleLaunchReschedule = () => {
    if (activeAlloc) {
      setSelectedRoomId(activeAlloc.roomId);
      setViewMode('room');
      initiateReschedule(activeAlloc);
    } else if (currentCourse) {
      // If no allocation, open vacant rooms modal
      openVacantRoomsModal(currentCourse.id);
    }
  };

  // Launch Vacant Rooms Modal for this section
  const handleLaunchVacantRooms = () => {
    openVacantRoomsModal(currentCourse?.id);
  };

  return (
    <div className="bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/20 dark:border-white/10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
      {/* Selector Controls */}
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Course Code Dropdown */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider flex items-center gap-1">
            <Search className="w-3 h-3 text-blue-300" />
            Select Course:
          </span>
          <select
            value={selectedCourseCode}
            onChange={(e) => handleCourseChange(e.target.value)}
            aria-label="Select course"
            className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs font-bold rounded-xl px-3 py-2 border border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
          >
            {uniqueCourseOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.title.slice(0, 28)}
              </option>
            ))}
          </select>
        </div>

        {/* Section Dropdown */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-300" />
            Section:
          </span>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            aria-label="Select section"
            className="bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 text-xs font-extrabold rounded-xl px-3 py-2 border border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
          >
            {availableSections.map((sec) => (
              <option key={sec.id} value={sec.section}>
                Section {sec.section}
              </option>
            ))}
          </select>
        </div>

        {/* Current Schedule Status Pill */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">
            Current Schedule:
          </span>
          {activeAlloc ? (
            <div className="bg-blue-950/60 text-blue-200 border border-blue-400/30 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              <span>
                <strong>{activeAlloc.day}</strong> in <strong>{activeAlloc.roomId}</strong>
              </span>
              <span className="text-[10px] text-blue-300/80 font-mono">
                ({getAllocationInterval(activeAlloc.slotId).startTime} - {getAllocationInterval(activeAlloc.slotId).endTime})
              </span>
            </div>
          ) : (
            <div className="bg-amber-950/60 text-amber-200 border border-amber-400/30 rounded-xl px-3 py-1.5 text-xs">
              <span>Unallocated session</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={handleLaunchReschedule}
          disabled={!activeAlloc}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-blue-950 font-black text-xs transition-all shadow-md hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
          title="Open the 6x6 recommendation matrix for this course"
        >
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Reschedule Slot</span>
        </button>

        <button
          onClick={handleLaunchVacantRooms}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md hover:scale-[1.02] border border-blue-400/40"
          title="Scan all 75 campus rooms to find 100% vacant rooms and reassign"
        >
          <DoorOpen className="w-4 h-4" />
          <span>Find Vacant Rooms</span>
        </button>
      </div>
    </div>
  );
};
