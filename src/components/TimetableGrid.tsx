import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from '../lib/constants';
import { CourseCard } from './CourseCard';
import {
  Building2,
  Calendar,
  Search,
  Filter,
  Sparkles,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { DayOfWeek, Room, TimeSlot } from '../types/timetable';

export const TimetableGrid: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    rooms,
    courses,
    students,
    allocations,
    selectedRoomId,
    setSelectedRoomId,
    selectedDay,
    setSelectedDay,
    searchQuery,
    setSearchQuery,
    departmentFilter,
    setDepartmentFilter,
    openFlexibleModal,
  } = useTimetableStore();

  // Scroll synchronization refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState<number>(2000);

  // Room categories filter
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<'ALL' | 'Block C' | 'Block D' | 'Labs'>('ALL');
  // Adaptive slots toggle: when true, hides irrelevant slots (e.g. lab slots for classrooms, theory slots for labs)
  const [adaptiveSlotsOnly, setAdaptiveSlotsOnly] = useState<boolean>(true);

  // Selected room object
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  // Room index for previous/next navigation
  const currentRoomIndex = rooms.findIndex((r) => r.id === selectedRoomId);

  // Filtered rooms based on category tab
  const filteredRooms = useMemo(() => {
    if (roomCategoryFilter === 'ALL') return rooms;
    if (roomCategoryFilter === 'Labs') {
      return rooms.filter((r) => r.type === 'Lab');
    }
    if (roomCategoryFilter === 'Block C') {
      return rooms.filter((r) => r.building.includes('Block C') && r.type !== 'Lab');
    }
    if (roomCategoryFilter === 'Block D') {
      return rooms.filter((r) => r.building.includes('Block D') && r.type !== 'Lab');
    }
    return rooms;
  }, [rooms, roomCategoryFilter]);

  // Unique departments for filter
  const departments = useMemo(() => {
    return ['ALL', ...Array.from(new Set(courses.map((c) => c.department)))];
  }, [courses]);

  // Determine active slots adaptively
  const activeSlots = useMemo(() => {
    if (!adaptiveSlotsOnly) {
      return STANDARD_TIME_SLOTS;
    }

    if (viewMode === 'room') {
      const isLab = selectedRoom.type === 'Lab';
      if (isLab) {
        // Show lab slots 9 to 12
        return STANDARD_TIME_SLOTS.filter(
          (s) => s.slotNumber >= 9 || s.id.startsWith('lab')
        );
      } else {
        // Show theory slots 1 to 6 (and 7-8 if evening courses exist)
        const hasEvening = allocations.some(
          (a) =>
            a.roomId === selectedRoomId &&
            (a.slotId === 'slot-7' || a.slotId === 'slot-8')
        );
        return STANDARD_TIME_SLOTS.filter(
          (s) => s.slotNumber <= 6 || (hasEvening && (s.slotNumber === 7 || s.slotNumber === 8))
        );
      }
    } else {
      // Day View
      if (roomCategoryFilter === 'Labs') {
        return STANDARD_TIME_SLOTS.filter(
          (s) => s.slotNumber >= 9 || s.id.startsWith('lab')
        );
      } else if (roomCategoryFilter === 'Block C' || roomCategoryFilter === 'Block D') {
        return STANDARD_TIME_SLOTS.filter((s) => s.slotNumber <= 8);
      } else {
        // All rooms: return all slots
        return STANDARD_TIME_SLOTS;
      }
    }
  }, [adaptiveSlotsOnly, viewMode, selectedRoom, selectedRoomId, roomCategoryFilter, allocations]);

  // Sync top scrollbar with main scroll container
  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleMainScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
  };

  // Re-measure content width when view or rooms change
  useEffect(() => {
    const updateWidth = () => {
      if (mainScrollRef.current) {
        setScrollContentWidth(mainScrollRef.current.scrollWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 150);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [viewMode, filteredRooms, selectedRoomId, selectedDay, activeSlots]);

  // Quick scroll buttons
  const scrollHorizontally = (delta: number) => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // Navigate to previous or next room in list
  const navigateRoom = (direction: 'prev' | 'next') => {
    if (rooms.length === 0) return;
    let nextIdx = direction === 'next' ? currentRoomIndex + 1 : currentRoomIndex - 1;
    if (nextIdx >= rooms.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = rooms.length - 1;
    setSelectedRoomId(rooms[nextIdx].id);
  };

  // Helper to filter allocations based on search & department
  const isAllocationVisible = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return false;

    if (departmentFilter !== 'ALL' && course.department !== departmentFilter) {
      return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchCourse =
        course.courseCode.toLowerCase().includes(q) ||
        course.courseTitle.toLowerCase().includes(q) ||
        course.section.toLowerCase().includes(q) ||
        course.instructor.toLowerCase().includes(q);
      return matchCourse;
    }

    return true;
  };

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Top Control Bar: View Modes, Navigation & Filters */}
      <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-200/80 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('room')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'room'
                  ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Room Schedule
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Day Overview ({filteredRooms.length} Rooms)
            </button>
          </div>

          {/* Adaptive Slot Toggle Pill */}
          <button
            onClick={() => setAdaptiveSlotsOnly(!adaptiveSlotsOnly)}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              adaptiveSlotsOnly
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
            }`}
            title="Automatically hides irrelevant slots (e.g. lab slots for classrooms, theory slots for labs)"
          >
            <SlidersHorizontal className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>{adaptiveSlotsOnly ? 'Adaptive Slots: ON' : 'All 12 Slots: ON'}</span>
          </button>
        </div>

        {/* Center: Search Input & Department Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search course or instructor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter by department"
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'ALL' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-bar: Room Category Filter & Context Selector */}
      <div className="px-4 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Room Category Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Category:
          </span>
          <button
            onClick={() => setRoomCategoryFilter('ALL')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all border ${
              roomCategoryFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200'
            }`}
          >
            All Rooms ({rooms.length})
          </button>
          <button
            onClick={() => setRoomCategoryFilter('Block C')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all border ${
              roomCategoryFilter === 'Block C'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200'
            }`}
          >
            🏛️ Block C Classrooms (28)
          </button>
          <button
            onClick={() => setRoomCategoryFilter('Block D')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all border ${
              roomCategoryFilter === 'Block D'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200'
            }`}
          >
            🏛️ Block D Classrooms (32)
          </button>
          <button
            onClick={() => setRoomCategoryFilter('Labs')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all border ${
              roomCategoryFilter === 'Labs'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200'
            }`}
          >
            💻 Computing & Tech Labs (18)
          </button>
        </div>

        {/* View Specific Controls */}
        {viewMode === 'room' ? (
          /* Room View: Room Navigation & Dropdown */
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateRoom('prev')}
              className="p-1 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
              title="Previous Room"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              aria-label="Select room"
              className="px-2.5 py-1 font-bold bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.type} • {r.capacity} seats • {r.building})
                </option>
              ))}
            </select>

            <button
              onClick={() => navigateRoom('next')}
              className="p-1 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
              title="Next Room"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Day View: Day Tabs */
          <div className="flex items-center gap-1">
            <span className="font-bold text-gray-500 dark:text-gray-400 mr-1">Day:</span>
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-2.5 py-1 rounded-md font-bold transition-all border ${
                  selectedDay === day
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-200'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TOP HORIZONTAL SCROLLBAR & PANNING BAR */}
      <div className="bg-slate-100/90 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-700/80 px-3 py-1.5 flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 font-medium shrink-0">
          <button
            onClick={() => scrollHorizontally(-350)}
            className="p-1 rounded bg-white dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 border border-gray-300 dark:border-zinc-600 shadow-2xs"
            title="Scroll grid left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="hidden sm:inline">Pan Grid</span>
          <button
            onClick={() => scrollHorizontally(350)}
            className="p-1 rounded bg-white dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 border border-gray-300 dark:border-zinc-600 shadow-2xs"
            title="Scroll grid right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top Scrollbar Track */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden py-0.5 scrollbar-thin"
          style={{ maxHeight: '16px' }}
        >
          <div style={{ width: `${scrollContentWidth}px`, height: '8px' }} className="rounded-full bg-transparent" />
        </div>

        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium shrink-0 hidden md:block">
          {viewMode === 'room' ? (
            <span>
              <strong>{selectedRoom.name}</strong> • {selectedRoom.type} ({selectedRoom.capacity} seats)
            </span>
          ) : (
            <span>
              <strong>{selectedDay}</strong> • Showing {filteredRooms.length} rooms
            </span>
          )}
        </div>
      </div>

      {/* Main Grid View Container */}
      <div
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="flex-1 overflow-x-auto overflow-y-auto max-h-[72vh] p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-950/40 relative"
      >
        {viewMode === 'room' ? (
          /* ROOM VIEW: Columns are 6 Days (Mon - Sat), Rows are Slots */
          <div className="min-w-[960px]">
            <div className="grid grid-cols-[140px_repeat(6,minmax(130px,1fr))] gap-2.5">
              {/* Header Row: Corner Sticky Time Slot */}
              <div className="sticky left-0 top-0 z-30 p-2.5 text-center text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-300 dark:border-zinc-700 flex items-center justify-center shadow-xs">
                Time Slot
              </div>

              {/* Day Headers (Sticky Top) */}
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="sticky top-0 z-10 p-2.5 text-center text-xs font-extrabold text-gray-800 dark:text-gray-100 uppercase tracking-wider bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xs"
                >
                  {day}
                </div>
              ))}

              {/* Time Slot Rows */}
              {activeSlots.map((slot) => {
                const isLabSlot = slot.slotNumber >= 9 || slot.id.startsWith('lab');

                return (
                  <React.Fragment key={slot.id}>
                    {/* Time Slot Label Cell (Sticky Left Column) */}
                    <div
                      className={`sticky left-0 z-20 p-2 rounded-xl border flex flex-col justify-center items-center text-center backdrop-blur-md shadow-xs ${
                        isLabSlot
                          ? 'bg-amber-50/95 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          : 'bg-white/95 dark:bg-zinc-800/95 border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black">
                          {isLabSlot ? `Lab ${slot.slotNumber - 8}` : `Slot ${slot.slotNumber}`}
                        </span>
                        {isLabSlot && (
                          <span className="text-[9px] font-bold px-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                            2h 45m
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] opacity-75 font-mono mt-0.5">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>

                    {/* Day Cells */}
                    {DAYS_OF_WEEK.map((day) => {
                      const cellAllocation = allocations.find(
                        (a) =>
                          a.day === day &&
                          a.roomId === selectedRoomId &&
                          a.slotId === slot.id
                      );

                      const course = cellAllocation
                        ? courses.find((c) => c.id === cellAllocation.courseSectionId)
                        : null;

                      const isVisible = cellAllocation ? isAllocationVisible(cellAllocation.courseSectionId) : true;

                      return (
                        <div
                          key={`${day}-${slot.id}`}
                          className="min-h-[115px] p-1 bg-white/70 dark:bg-zinc-900/60 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 flex flex-col transition-all"
                        >
                          {cellAllocation && course && isVisible ? (
                            <CourseCard
                              allocation={cellAllocation}
                              course={course}
                              room={selectedRoom}
                              students={students}
                            />
                          ) : (
                            <div
                              onClick={() => openFlexibleModal(undefined)}
                              className="h-full w-full rounded-lg hover:bg-blue-50/80 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 border border-transparent flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600 transition-all group cursor-pointer p-2"
                              title={`Allocate makeup/seminar in ${selectedRoom.name} on ${day} (${slot.startTime}-${slot.endTime})`}
                            >
                              <span className="text-[11px] font-semibold opacity-60 group-hover:opacity-100 flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
                                <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                                Available
                              </span>
                              <span className="text-[9px] opacity-40 font-mono mt-0.5">
                                {isLabSlot ? '165m window' : '80m window'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          /* DAY VIEW: Columns are Rooms, Rows are Slots */
          <div
            style={{
              minWidth: `${140 + filteredRooms.length * 150}px`,
            }}
          >
            <div
              className="grid gap-2.5"
              style={{
                gridTemplateColumns: `140px repeat(${filteredRooms.length}, minmax(140px, 1fr))`,
              }}
            >
              {/* Corner Header (Sticky Top-Left) */}
              <div className="sticky left-0 top-0 z-30 p-2.5 text-center text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-300 dark:border-zinc-700 flex items-center justify-center shadow-xs">
                Time Slot
              </div>

              {/* Room Headers (Sticky Top) */}
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    setViewMode('room');
                  }}
                  className="sticky top-0 z-10 p-2.5 text-center bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xs cursor-pointer hover:border-blue-400 transition-colors group"
                  title="Click to switch to this Room's weekly view"
                >
                  <div className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                    {room.name}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    {room.type} • {room.capacity} seats
                  </div>
                </div>
              ))}

              {/* Time Slot Rows */}
              {activeSlots.map((slot) => {
                const isLabSlot = slot.slotNumber >= 9 || slot.id.startsWith('lab');

                return (
                  <React.Fragment key={slot.id}>
                    {/* Time Slot Label Cell (Sticky Left Column) */}
                    <div
                      className={`sticky left-0 z-20 p-2 rounded-xl border flex flex-col justify-center items-center text-center backdrop-blur-md shadow-xs ${
                        isLabSlot
                          ? 'bg-amber-50/95 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          : 'bg-white/95 dark:bg-zinc-800/95 border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black">
                          {isLabSlot ? `Lab ${slot.slotNumber - 8}` : `Slot ${slot.slotNumber}`}
                        </span>
                        {isLabSlot && (
                          <span className="text-[9px] font-bold px-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                            2h 45m
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] opacity-75 font-mono mt-0.5">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>

                    {/* Room Columns */}
                    {filteredRooms.map((room) => {
                      const cellAllocation = allocations.find(
                        (a) =>
                          a.day === selectedDay &&
                          a.roomId === room.id &&
                          a.slotId === slot.id
                      );

                      const course = cellAllocation
                        ? courses.find((c) => c.id === cellAllocation.courseSectionId)
                        : null;

                      const isVisible = cellAllocation ? isAllocationVisible(cellAllocation.courseSectionId) : true;

                      return (
                        <div
                          key={`${room.id}-${slot.id}`}
                          className="min-h-[115px] p-1 bg-white/70 dark:bg-zinc-900/60 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 flex flex-col transition-all"
                        >
                          {cellAllocation && course && isVisible ? (
                            <CourseCard
                              allocation={cellAllocation}
                              course={course}
                              room={room}
                              students={students}
                            />
                          ) : (
                            <div
                              onClick={() => openFlexibleModal(undefined)}
                              className="h-full w-full rounded-lg hover:bg-blue-50/80 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 border border-transparent flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600 transition-all group cursor-pointer p-2"
                              title={`Room ${room.name} is free on ${selectedDay} (${slot.startTime}-${slot.endTime})`}
                            >
                              <span className="text-[11px] font-semibold opacity-60 group-hover:opacity-100 flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
                                <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                                Available
                              </span>
                              <span className="text-[9px] opacity-40 font-mono mt-0.5">
                                {isLabSlot ? '165m window' : '80m window'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
