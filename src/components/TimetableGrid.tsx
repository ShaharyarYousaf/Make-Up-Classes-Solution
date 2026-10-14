import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimetableStore } from '../store/timetableStore';
import { getCourseMap, getSectionRoster } from '../lib/engine';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from '../lib/constants';
import { TimelineColumn, TimelineColumns } from './TimelineColumns';
import { allocationInterval, layoutLanes } from '../lib/timeline';
import {
  Building2,
  Calendar,
  Search,
  Filter,
  X,
  CalendarRange,
  Users,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Allocation, DayOfWeek } from '../types/timetable';

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
    openBatchAvailability,
  } = useTimetableStore(
    useShallow((s) => ({
      viewMode: s.viewMode,
      setViewMode: s.setViewMode,
      rooms: s.rooms,
      courses: s.courses,
      students: s.students,
      allocations: s.allocations,
      selectedRoomId: s.selectedRoomId,
      setSelectedRoomId: s.setSelectedRoomId,
      selectedDay: s.selectedDay,
      setSelectedDay: s.setSelectedDay,
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      departmentFilter: s.departmentFilter,
      setDepartmentFilter: s.setDepartmentFilter,
      openFlexibleModal: s.openFlexibleModal,
      openBatchAvailability: s.openBatchAvailability,
    }))
  );

  const courseMap = getCourseMap(courses);
  const sectionRoster = getSectionRoster(students);

  // day|room -> allocations, built once instead of filtering all allocations per column
  const dayRoomIndex = useMemo(() => {
    const index = new Map<string, Allocation[]>();
    for (const alloc of allocations) {
      const key = `${alloc.day}|${alloc.roomId}`;
      const list = index.get(key);
      if (list) list.push(alloc);
      else index.set(key, [alloc]);
    }
    return index;
  }, [allocations]);

  // Scroll synchronization refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState<number>(2000);

  // Room categories filter
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<'ALL' | 'Block C' | 'Block D' | 'Labs'>('ALL');

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

  // Searching for a course or teacher switches to a week grid of every matching session (Req C)
  const searchTerm = searchQuery.trim().toLowerCase();
  const searchActive = searchTerm !== '';
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const searchMatches = useMemo(() => {
    if (!searchActive) return [];
    return allocations.filter((alloc) => {
      const course = courseMap.get(alloc.courseSectionId);
      if (!course) return false;
      if (departmentFilter !== 'ALL' && course.department !== departmentFilter) return false;
      return (
        course.courseCode.toLowerCase().includes(searchTerm) ||
        course.courseTitle.toLowerCase().includes(searchTerm) ||
        course.section.toLowerCase().includes(searchTerm) ||
        course.instructor.toLowerCase().includes(searchTerm)
      );
    });
  }, [searchActive, searchTerm, allocations, courseMap, departmentFilter]);

  /** Too broad a search ("CS") would draw hundreds of side-by-side tiles */
  const SEARCH_LIMIT = 150;
  const searchShown = searchMatches.length > SEARCH_LIMIT ? searchMatches.slice(0, SEARCH_LIMIT) : searchMatches;
  const searchSummary = useMemo(() => {
    const sections = new Set(searchMatches.map((a) => a.courseSectionId));
    const teachers = new Set(
      searchMatches.map((a) => courseMap.get(a.courseSectionId)?.instructor).filter((t): t is string => !!t)
    );
    return { sections: sections.size, teachers: Array.from(teachers) };
  }, [searchMatches, courseMap]);

  const visibleColumns = useMemo(() => {
    if (searchActive) {
      return DAYS_OF_WEEK.map((day) => ({ day, roomId: '', allocations: searchShown.filter((a) => a.day === day) }));
    }
    const columns: { day: DayOfWeek; roomId: string }[] =
      viewMode === 'room'
        ? DAYS_OF_WEEK.map((day) => ({ day, roomId: selectedRoomId }))
        : filteredRooms.map((room) => ({ day: selectedDay, roomId: room.id }));
    return columns.map((c) => ({ ...c, allocations: dayRoomIndex.get(`${c.day}|${c.roomId}`) || [] }));
  }, [searchActive, searchShown, viewMode, selectedRoomId, selectedDay, filteredRooms, dayRoomIndex]);

  // Week view columns widen with the most sessions running at the same time on any day
  const searchColumnWidth = useMemo(() => {
    if (!searchActive) return 0;
    let maxLanes = 1;
    for (const col of visibleColumns) {
      for (const e of layoutLanes(col.allocations, allocationInterval)) maxLanes = Math.max(maxLanes, e.lanes);
    }
    return Math.min(Math.max(150, maxLanes * 110), 660);
  }, [searchActive, visibleColumns]);

  // Timeline range: the regular day, stretched to cover anything earlier or later
  const { dayStart, dayEnd } = useMemo(() => {
    let start = 8 * 60 + 30;
    let end = 17 * 60 + 15;
    for (const col of visibleColumns) {
      for (const alloc of col.allocations) {
        const interval = allocationInterval(alloc);
        start = Math.min(start, interval.startMinutes);
        end = Math.max(end, interval.endMinutes);
      }
    }
    return { dayStart: Math.floor(start / 30) * 30, dayEnd: Math.ceil(end / 15) * 15 };
  }, [visibleColumns]);

  // Slot bands drawn behind the timeline: lab blocks for labs, theory slots otherwise
  const bands = useMemo(() => {
    const labView = searchActive
      ? false
      : viewMode === 'room'
      ? selectedRoom?.type === 'Lab'
      : roomCategoryFilter === 'Labs';
    return STANDARD_TIME_SLOTS.filter(
      (s) => (labView ? s.id.startsWith('lab') : !s.id.startsWith('lab')) && s.startMinutes < dayEnd && s.endMinutes > dayStart
    );
  }, [searchActive, viewMode, selectedRoom, roomCategoryFilter, dayStart, dayEnd]);

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
  }, [viewMode, filteredRooms, selectedRoomId, selectedDay, dayStart, dayEnd, searchActive, searchColumnWidth]);

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
  const isAllocationVisible = (alloc: Allocation) => {
    const course = courseMap.get(alloc.courseSectionId);
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-200/80 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => {
                setViewMode('room');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'room' && !searchActive
                  ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Room Schedule
            </button>
            <button
              onClick={() => {
                setViewMode('day');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'day' && !searchActive
                  ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Day Overview ({filteredRooms.length} Rooms)
            </button>
          </div>
          <button
            onClick={openBatchAvailability}
            title="Find when several sections are all free together"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5" />
            Common free time
          </button>
        </div>

        {/* Center: Search Input & Department Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Course or teacher → week view"
              aria-label="Search course or teacher"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-zinc-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56 ${
                searchActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300 dark:border-zinc-700'
              }`}
            />
            {searchActive && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter by department"
            className="max-w-[40vw] sm:max-w-none px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'ALL' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {searchActive && (
        <div className="px-4 py-2.5 border-b border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
          <span className="flex items-center gap-1.5 min-w-0">
            <CalendarRange className="w-4 h-4 shrink-0" />
            <span className="truncate">
              Week view for <strong>“{searchQuery.trim()}”</strong>: {searchMatches.length} session
              {searchMatches.length === 1 ? '' : 's'} · {searchSummary.sections} section{searchSummary.sections === 1 ? '' : 's'}
              {searchSummary.teachers.length > 0 && searchSummary.teachers.length <= 3 && <> · {searchSummary.teachers.join(', ')}</>}
              {searchSummary.teachers.length > 3 && <> · {searchSummary.teachers.length} teachers</>}
            </span>
          </span>
          {searchMatches.length > SEARCH_LIMIT && (
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Showing the first {SEARCH_LIMIT} – type more to narrow it down
            </span>
          )}
          {searchMatches.length === 0 && <span className="font-semibold">No classes match. Try a course code, title, section or teacher.</span>}
        </div>
      )}

      {/* Sub-bar: Room Category Filter & Context Selector */}
      <div
        className={`px-4 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-wrap items-center justify-between gap-3 text-xs ${
          searchActive ? 'hidden' : 'flex'
        }`}
      >
        {/* Room Category Tabs: one sideways-scrolling row on phones */}
        <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible max-w-full [&>*]:shrink-0 [&>*]:whitespace-nowrap">
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
              className="max-w-[60vw] sm:max-w-xs px-2.5 py-1 font-bold bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          {searchActive ? (
            <span>
              <strong>Week view</strong> • {searchMatches.length} sessions
            </span>
          ) : viewMode === 'room' ? (
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
        className="flex-1 overflow-x-auto overflow-y-auto max-h-[72vh] px-3 pb-3 sm:px-4 sm:pb-4 bg-slate-50/50 dark:bg-zinc-950/40 relative"
      >
        <div
          style={{
            minWidth: `${
              64 + visibleColumns.length * (searchActive ? searchColumnWidth + 8 : viewMode === 'room' ? 140 : 150)
            }px`,
          }}
        >
          <TimelineColumns
            columns={visibleColumns.map((col): TimelineColumn => {
              if (searchActive) {
                return {
                  key: `search|${col.day}`,
                  day: col.day,
                  roomId: '',
                  allocations: col.allocations,
                  roomFor: (alloc) => roomById.get(alloc.roomId) || selectedRoom,
                  freeLabel: col.day,
                  header: (
                    <div className="p-2.5 text-center text-xs font-extrabold text-gray-800 dark:text-gray-100 uppercase tracking-wider bg-blue-50/95 dark:bg-blue-950/80 backdrop-blur-md rounded-xl border border-blue-200 dark:border-blue-900 shadow-xs">
                      {col.day}
                      <span className="ml-1 font-semibold text-[10px] text-blue-700 dark:text-blue-300 normal-case">
                        ({col.allocations.length})
                      </span>
                    </div>
                  ),
                };
              }
              const room = roomById.get(col.roomId) || selectedRoom;
              return {
                key: `${col.day}|${col.roomId}`,
                day: col.day,
                roomId: col.roomId,
                allocations: col.allocations,
                roomFor: () => room,
                freeLabel: viewMode === 'room' ? `${room.name} on ${col.day}` : `${room.name} on ${selectedDay}`,
                header:
                  viewMode === 'room' ? (
                    <div className="p-2.5 text-center text-xs font-extrabold text-gray-800 dark:text-gray-100 uppercase tracking-wider bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xs">
                      {col.day}
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setSelectedRoomId(room.id);
                        setViewMode('room');
                      }}
                      className="p-2.5 text-center bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xs cursor-pointer hover:border-blue-400 transition-colors group"
                      title="Click to switch to this Room's weekly view"
                    >
                      <div className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                        {room.name}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        {room.type} • {room.capacity} seats
                      </div>
                    </div>
                  ),
              };
            })}
            columnWidth={searchActive ? searchColumnWidth : viewMode === 'room' ? 130 : 140}
            bands={bands}
            dayStart={dayStart}
            dayEnd={dayEnd}
            courseMap={courseMap}
            enrolledCount={(id) => sectionRoster.get(id)?.length || 0}
            isVisible={searchActive ? () => true : isAllocationVisible}
            onFreeClick={(gap) => openFlexibleModal(undefined, gap)}
            showFree={!searchActive}
            showRoomOnCards={searchActive}
          />
        </div>
      </div>
    </div>
  );
};
