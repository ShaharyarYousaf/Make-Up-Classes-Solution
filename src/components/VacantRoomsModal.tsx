import React, { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimetableStore } from '../store/timetableStore';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from '../lib/constants';
import { getSectionRoster, getVacantRooms, VacantRoomResult } from '../lib/engine';
import { getAllocationInterval } from '../lib/utils';
import { DayOfWeek, Room } from '../types/timetable';
import {
  X,
  Building2,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
  ArrowRight,
  Filter,
  DoorOpen,
  Sparkles,
} from 'lucide-react';

export const VacantRoomsModal: React.FC = () => {
  const {
    isVacantRoomsModalOpen,
    closeVacantRoomsModal,
    vacantRoomsTargetCourseId,
    courses,
    rooms,
    allocations,
    students,
    reassignRoom,
    initiateReschedule,
  } = useTimetableStore(
    useShallow((s) => ({
      isVacantRoomsModalOpen: s.isVacantRoomsModalOpen,
      closeVacantRoomsModal: s.closeVacantRoomsModal,
      vacantRoomsTargetCourseId: s.vacantRoomsTargetCourseId,
      courses: s.courses,
      rooms: s.rooms,
      allocations: s.allocations,
      students: s.students,
      reassignRoom: s.reassignRoom,
      initiateReschedule: s.initiateReschedule,
    }))
  );

  // Search & selections
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedAllocationId, setSelectedAllocationId] = useState<string>('');
  const [targetDay, setTargetDay] = useState<DayOfWeek>('Monday');
  const [targetSlotId, setTargetSlotId] = useState<string>('slot-1');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Classroom' | 'Lab'>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [onlyVacant, setOnlyVacant] = useState<boolean>(true);

  // Initialize course when modal opens
  React.useEffect(() => {
    if (isVacantRoomsModalOpen) {
      if (vacantRoomsTargetCourseId) {
        const found = courses.find((c) => c.id === vacantRoomsTargetCourseId);
        if (found) {
          setSelectedCourseCode(found.courseCode);
          setSelectedSection(found.section);
          const alloc = allocations.find((a) => a.courseSectionId === found.id);
          if (alloc) {
            setSelectedAllocationId(alloc.id);
            setTargetDay(alloc.day);
            setTargetSlotId(alloc.slotId);
          }
          return;
        }
      }

      // Default to first course with an allocation
      const firstAlloc = allocations[0];
      if (firstAlloc) {
        const c = courses.find((crs) => crs.id === firstAlloc.courseSectionId);
        if (c) {
          setSelectedCourseCode(c.courseCode);
          setSelectedSection(c.section);
          setSelectedAllocationId(firstAlloc.id);
          setTargetDay(firstAlloc.day);
          setTargetSlotId(firstAlloc.slotId);
        }
      }
    }
  }, [isVacantRoomsModalOpen, vacantRoomsTargetCourseId, courses, allocations]);

  // Unique course codes for picker
  const uniqueCourseCodes = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((c) => {
      if (!map.has(c.courseCode)) {
        map.set(c.courseCode, c.courseTitle);
      }
    });
    return Array.from(map.entries()).map(([code, title]) => ({ code, title }));
  }, [courses]);

  // Filtered course codes by search
  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return uniqueCourseCodes;
    const q = courseSearch.toLowerCase();
    return uniqueCourseCodes.filter(
      (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
  }, [uniqueCourseCodes, courseSearch]);

  // Sections for currently selected course code
  const availableSections = useMemo(() => {
    if (!selectedCourseCode) return [];
    return courses.filter((c) => c.courseCode === selectedCourseCode);
  }, [courses, selectedCourseCode]);

  // Currently selected CourseSection object
  const currentCourse = useMemo(() => {
    return courses.find(
      (c) => c.courseCode === selectedCourseCode && c.section === selectedSection
    );
  }, [courses, selectedCourseCode, selectedSection]);

  // Allocations for the selected course section
  const currentCourseAllocations = useMemo(() => {
    if (!currentCourse) return [];
    return allocations.filter((a) => a.courseSectionId === currentCourse.id);
  }, [allocations, currentCourse]);

  // The active allocation being examined / rescheduled
  const activeAllocation = useMemo(() => {
    if (!currentCourseAllocations.length) return null;
    return (
      currentCourseAllocations.find((a) => a.id === selectedAllocationId) ||
      currentCourseAllocations[0]
    );
  }, [currentCourseAllocations, selectedAllocationId]);

  // When course code changes, automatically select its first section
  const handleCourseCodeChange = (code: string) => {
    setSelectedCourseCode(code);
    const secs = courses.filter((c) => c.courseCode === code);
    if (secs.length > 0) {
      setSelectedSection(secs[0].section);
      const allocs = allocations.filter((a) => a.courseSectionId === secs[0].id);
      if (allocs.length > 0) {
        setSelectedAllocationId(allocs[0].id);
        setTargetDay(allocs[0].day);
        setTargetSlotId(allocs[0].slotId);
      }
    }
  };

  // When section changes, update target allocation
  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    const c = courses.find((crs) => crs.courseCode === selectedCourseCode && crs.section === section);
    if (c) {
      const allocs = allocations.filter((a) => a.courseSectionId === c.id);
      if (allocs.length > 0) {
        setSelectedAllocationId(allocs[0].id);
        setTargetDay(allocs[0].day);
        setTargetSlotId(allocs[0].slotId);
      }
    }
  };

  // Enrolled student count for current course
  const enrolledStudents = useMemo(() => {
    if (!currentCourse) return [];
    return getSectionRoster(students).get(currentCourse.id) || [];
  }, [students, currentCourse]);

  // Target interval in minutes
  const targetInterval = useMemo(() => {
    return getAllocationInterval(targetSlotId);
  }, [targetSlotId]);

  // Selected slot object
  const currentSlotObj = useMemo(() => {
    return STANDARD_TIME_SLOTS.find((s) => s.id === targetSlotId) || STANDARD_TIME_SLOTS[0];
  }, [targetSlotId]);

  // Compute vacant rooms
  // Only scan while the modal is open – this component stays mounted when closed
  const roomVacancyResults: VacantRoomResult[] = useMemo(() => {
    if (!isVacantRoomsModalOpen) return [];
    return getVacantRooms(
      targetDay,
      targetInterval,
      allocations,
      rooms,
      courses,
      students,
      currentCourse?.id,
      activeAllocation?.id
    );
  }, [
    isVacantRoomsModalOpen,
    targetDay,
    targetInterval,
    allocations,
    rooms,
    courses,
    students,
    currentCourse?.id,
    activeAllocation?.id,
  ]);

  // Filter vacancy results by UI filters
  const filteredRooms = useMemo(() => {
    return roomVacancyResults.filter((item) => {
      if (onlyVacant && !item.isVacant) return false;

      if (typeFilter !== 'ALL') {
        const isLab = item.room.type.toLowerCase().includes('lab');
        if (typeFilter === 'Lab' && !isLab) return false;
        if (typeFilter === 'Classroom' && isLab) return false;
      }

      if (buildingFilter !== 'ALL' && item.room.building !== buildingFilter) {
        return false;
      }

      return true;
    });
  }, [roomVacancyResults, onlyVacant, typeFilter, buildingFilter]);

  // Unique buildings for filter
  const buildings = useMemo(() => {
    return ['ALL', ...Array.from(new Set(rooms.map((r) => r.building)))];
  }, [rooms]);

  // Vacancy stats
  const totalVacant = roomVacancyResults.filter((r) => r.isVacant).length;
  const totalOccupied = roomVacancyResults.filter((r) => !r.isVacant).length;

  if (!isVacantRoomsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Vacant Rooms & Live Reschedule Assistant
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Real-Time Campus Scanner
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select any course section to view vacant rooms, detect student clashes, and reassign classrooms.
              </p>
            </div>
          </div>

          <button
            onClick={closeVacantRoomsModal}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Course & Target Time Selection Controls */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Step 1: Course Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              1. Select Course Code:
            </label>
            <div className="flex gap-2">
              <select
                value={selectedCourseCode}
                onChange={(e) => handleCourseCodeChange(e.target.value)}
                aria-label="Select course code"
                className="flex-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {uniqueCourseCodes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.title.slice(0, 32)}
                  </option>
                ))}
              </select>
            </div>
            {currentCourse && (
              <span className="text-[11px] text-gray-500 font-medium truncate">
                {currentCourse.courseTitle} ({currentCourse.department})
              </span>
            )}
          </div>

          {/* Step 2: Section & Session Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              2. Select Section:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedSection}
                onChange={(e) => handleSectionChange(e.target.value)}
                aria-label="Select section"
                className="flex-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.section}>
                    Section {sec.section}
                  </option>
                ))}
              </select>
              <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded font-semibold text-[11px] border border-blue-200 dark:border-blue-900 shrink-0">
                {enrolledStudents.length} Students
              </span>
            </div>

            {/* Currently scheduled session pill */}
            {activeAllocation ? (
              <div className="text-[11px] text-gray-600 dark:text-gray-400 bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                <span>
                  Now: <strong>{activeAllocation.day}</strong> in <strong>{activeAllocation.roomId}</strong>
                </span>
                <span className="text-gray-400 font-mono text-[10px]">
                  {getAllocationInterval(activeAllocation.slotId).startTime} - {getAllocationInterval(activeAllocation.slotId).endTime}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                ⚠️ No current allocation found
              </span>
            )}
          </div>

          {/* Step 3: Target Time Slot to Inspect Vacancy */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              3. Check Vacancy For:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={targetDay}
                onChange={(e) => setTargetDay(e.target.value as DayOfWeek)}
                aria-label="Target day"
                className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={targetSlotId}
                onChange={(e) => setTargetSlotId(e.target.value)}
                aria-label="Target time slot"
                className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STANDARD_TIME_SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    Slot {s.slotNumber} ({s.startTime}-{s.endTime})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Scanning window: <strong>{currentSlotObj.startTime} - {currentSlotObj.endTime}</strong> on <strong>{targetDay}</strong>
            </span>
          </div>
        </div>

        {/* Filter Sub-bar */}
        <div className="p-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>{totalVacant} Vacant Rooms</span>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-lg font-medium">
              <span>{totalOccupied} Occupied</span>
            </div>

            {/* Room Type Filter */}
            <div className="flex items-center gap-1 ml-2">
              <span className="text-gray-500 font-semibold">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                aria-label="Filter room type"
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-2 py-1 font-medium"
              >
                <option value="ALL">All Types</option>
                <option value="Classroom">Classrooms Only</option>
                <option value="Lab">Labs Only</option>
              </select>
            </div>

            {/* Building Filter */}
            <div className="flex items-center gap-1">
              <span className="text-gray-500 font-semibold">Building:</span>
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                aria-label="Filter building"
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-2 py-1 font-medium"
              >
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b === 'ALL' ? 'All Buildings' : b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700 dark:text-gray-300 select-none">
              <input
                type="checkbox"
                checked={onlyVacant}
                onChange={(e) => setOnlyVacant(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span>Show Vacant Only</span>
            </label>

            {activeAllocation && (
              <button
                onClick={() => {
                  closeVacantRoomsModal();
                  initiateReschedule(activeAllocation);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Full 6×6 Matrix</span>
              </button>
            )}
          </div>
        </div>

        {/* Room Grid / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredRooms.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-400 opacity-60" />
              <p className="text-sm font-semibold">No rooms match your filter criteria.</p>
              <p className="text-xs text-gray-400 mt-1">Try unchecking &ldquo;Show Vacant Only&rdquo; or changing the target slot.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRooms.map((item) => {
                const isUnderCapacity = enrolledStudents.length > item.room.capacity;

                return (
                  <div
                    key={item.room.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                      item.isVacant
                        ? 'bg-white dark:bg-zinc-800/80 border-gray-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 shadow-xs'
                        : 'bg-gray-50/60 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Room Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                              {item.room.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.isVacant
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              }`}
                            >
                              {item.isVacant ? 'VACANT' : 'OCCUPIED'}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {item.room.type} • {item.room.building}
                          </span>
                        </div>

                        {/* Capacity Badge */}
                        <div
                          className={`text-right shrink-0 px-2 py-1 rounded text-xs font-bold ${
                            isUnderCapacity
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300'
                          }`}
                          title={
                            isUnderCapacity
                              ? `Room capacity (${item.room.capacity}) is smaller than course enrollment (${enrolledStudents.length})`
                              : `Capacity: ${item.room.capacity}`
                          }
                        >
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {item.room.capacity} seats
                          </span>
                        </div>
                      </div>

                      {/* Status / Occupant Info */}
                      <div className="my-2 text-xs">
                        {item.isVacant ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {item.clashStatus === 'SAFE'
                                ? 'Free with 0 student clashes'
                                : `${item.studentClashCount} student clash(es)`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                            <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="truncate">
                              {item.occupyingCourse
                                ? `${item.occupyingCourse.courseCode} (${item.occupyingCourse.section})`
                                : item.reason}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-700/60 flex items-center justify-between">
                      {item.isVacant ? (
                        <button
                          onClick={() => {
                            if (activeAllocation) {
                              reassignRoom(activeAllocation.id, item.room.id);
                              closeVacantRoomsModal();
                            }
                          }}
                          disabled={!activeAllocation}
                          className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <span>Reassign to {item.room.name}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">Occupied during this window</span>
                      )}
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
