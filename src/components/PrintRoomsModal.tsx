import React, { useEffect, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { Printer, X } from 'lucide-react';
import { useTimetableStore } from '../store/timetableStore';
import { getCourseMap } from '../lib/engine';
import { allocationInterval } from '../lib/timeline';
import { Allocation, Room } from '../types/timetable';
import { Combobox } from './Combobox';
import { PrintableRoomSchedule, PrintOrientation } from './PrintableRoomSchedule';

type Mode = 'single' | 'multiple' | 'all';

const TERM_LABEL = 'Fall 2026';

const tabClass = (active: boolean) =>
  `flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
    active ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
  }`;

/** Choose rooms and print their weekly schedules, one A4 landscape page per room. */
export const PrintRoomsModal: React.FC = () => {
  const { isOpen, close, rooms, courses, allocations, selectedRoomId } = useTimetableStore(
    useShallow((s) => ({
      isOpen: s.isPrintModalOpen,
      close: s.closePrintModal,
      rooms: s.rooms,
      courses: s.courses,
      allocations: s.allocations,
      selectedRoomId: s.selectedRoomId,
    }))
  );

  const [mode, setMode] = useState<Mode>('single');
  const [singleRoomId, setSingleRoomId] = useState(selectedRoomId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [showTeacher, setShowTeacher] = useState(true);
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape');
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  const [printing, setPrinting] = useState<Room[] | null>(null);

  // Start with the room currently on screen
  useEffect(() => {
    if (isOpen) setSingleRoomId(selectedRoomId);
  }, [isOpen, selectedRoomId]);

  const byRoom = useMemo(() => {
    const map = new Map<string, Allocation[]>();
    for (const a of allocations) {
      const list = map.get(a.roomId);
      if (list) list.push(a);
      else map.set(a.roomId, [a]);
    }
    return map;
  }, [allocations]);

  const roomOptions = useMemo(
    () =>
      rooms.map((r) => ({
        value: r.id,
        label: r.name,
        detail: `${r.type}${r.capacity ? ` · ${r.capacity} seats` : ''} · ${byRoom.get(r.id)?.length || 0} entries`,
        keywords: r.building,
      })),
    [rooms, byRoom]
  );

  const visibleRooms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rooms.filter(
      (r) =>
        (typeFilter === 'ALL' || r.type === typeFilter) &&
        (!q || r.name.toLowerCase().includes(q) || r.building.toLowerCase().includes(q))
    );
  }, [rooms, filter, typeFilter]);

  const selection = useMemo(() => {
    const chosen =
      mode === 'single' ? rooms.filter((r) => r.id === singleRoomId) : mode === 'all' ? rooms : rooms.filter((r) => picked.has(r.id));
    return mode === 'single' || !skipEmpty ? chosen : chosen.filter((r) => (byRoom.get(r.id)?.length || 0) > 0);
  }, [mode, rooms, singleRoomId, picked, skipEmpty, byRoom]);

  // Print only the schedule pages: render them, set the paper orientation, open the print dialog, then clean up
  useEffect(() => {
    if (!printing) return;
    const pageStyle = document.createElement('style');
    pageStyle.textContent = `@page { size: A4 ${orientation}; margin: 8mm; }`;
    document.head.appendChild(pageStyle);
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done, { once: true });
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      pageStyle.remove();
    };
  }, [printing, orientation]);

  // Same time range on every page, so a stack of printed rooms lines up
  const range = useMemo(() => {
    let start = 8 * 60 + 30;
    let end = 17 * 60 + 15;
    for (const room of printing || []) {
      for (const a of byRoom.get(room.id) || []) {
        const i = allocationInterval(a);
        start = Math.min(start, i.startMinutes);
        end = Math.max(end, i.endMinutes);
      }
    }
    return { dayStart: Math.floor(start / 30) * 30, dayEnd: Math.ceil(end / 15) * 15 };
  }, [printing, byRoom]);

  const courseMap = useMemo(() => getCourseMap(courses), [courses]);
  const printedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const togglePicked = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const printPages =
    printing &&
    createPortal(
      <div id="print-root" className={`${orientation === 'portrait' ? 'print-portrait' : ''} ${blackAndWhite ? 'print-bw' : ''}`}>
        {printing.map((room) => (
          <PrintableRoomSchedule
            key={room.id}
            room={room}
            allocations={byRoom.get(room.id) || []}
            courseMap={courseMap}
            dayStart={range.dayStart}
            dayEnd={range.dayEnd}
            showTeacher={showTeacher}
            printedOn={printedOn}
            termLabel={TERM_LABEL}
            orientation={orientation}
          />
        ))}
      </div>,
      document.body
    );

  if (!isOpen) return printPages || null;

  return (
    <>
      {printPages}
      <div className="no-print fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={close}>
        <div
          className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Print room schedules</h3>
                <p className="text-xs text-gray-500">One A4 page per room, ready to post outside the door.</p>
              </div>
            </div>
            <button onClick={close} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 text-sm overflow-y-auto">
            <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
              <button className={tabClass(mode === 'single')} onClick={() => setMode('single')}>
                Single room
              </button>
              <button className={tabClass(mode === 'multiple')} onClick={() => setMode('multiple')}>
                Several rooms
              </button>
              <button className={tabClass(mode === 'all')} onClick={() => setMode('all')}>
                All rooms
              </button>
            </div>

            {mode === 'single' && (
              <Combobox
                options={roomOptions}
                value={singleRoomId}
                onChange={setSingleRoomId}
                ariaLabel="Room to print"
                placeholder="Room name or building…"
                inputClassName="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {mode === 'multiple' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter rooms…"
                    aria-label="Filter rooms"
                    className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Room type"
                    className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  >
                    <option value="ALL">All types</option>
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab</option>
                    <option value="Smart Classroom">Smart Classroom</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{picked.size} selected</span>
                  <span className="flex gap-3">
                    <button
                      className="font-semibold text-blue-600 hover:underline"
                      onClick={() => setPicked((prev) => new Set([...Array.from(prev), ...visibleRooms.map((r) => r.id)]))}
                    >
                      Select shown ({visibleRooms.length})
                    </button>
                    <button className="font-semibold text-gray-500 hover:underline" onClick={() => setPicked(new Set())}>
                      Clear
                    </button>
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 divide-y divide-gray-100 dark:divide-zinc-800">
                  {visibleRooms.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800">
                      <input type="checkbox" checked={picked.has(r.id)} onChange={() => togglePicked(r.id)} />
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{r.name}</span>
                      <span className="text-gray-500 truncate">
                        {r.type} · {byRoom.get(r.id)?.length || 0} entries
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {mode === 'all' && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Every room on the campus list ({rooms.length}). Sort the printed pages by room name.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Paper</span>
                <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button className={tabClass(orientation === 'landscape')} onClick={() => setOrientation('landscape')}>
                    Landscape
                  </button>
                  <button className={tabClass(orientation === 'portrait')} onClick={() => setOrientation('portrait')}>
                    Portrait
                  </button>
                </div>
              </div>
              <div>
                <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ink</span>
                <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button className={tabClass(!blackAndWhite)} onClick={() => setBlackAndWhite(false)}>
                    Color
                  </button>
                  <button className={tabClass(blackAndWhite)} onClick={() => setBlackAndWhite(true)}>
                    Black &amp; white
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-gray-700 dark:text-gray-300">
              {mode !== 'single' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} />
                  Skip rooms with nothing scheduled
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showTeacher} onChange={(e) => setShowTeacher(e.target.checked)} />
                Show teacher names
              </label>
            </div>

            <p className="text-[11px] text-gray-500">
              Includes current reschedules and make-up classes (marked “Rescheduled”). In the print dialog choose your
              printer, or <strong>Save as PDF</strong>. Turn on “Background graphics” for shaded blocks. If the dialog
              shows the wrong orientation, set it to {orientation} there too.
            </p>

            <button
              disabled={selection.length === 0}
              onClick={() => {
                // Render the pages synchronously so the print dialog sees them
                flushSync(() => setPrinting([...selection].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))));
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print {selection.length} page{selection.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
