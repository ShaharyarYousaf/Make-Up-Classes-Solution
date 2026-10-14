import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronDown, Clock, DoorOpen, Plus, Users, X } from 'lucide-react';
import { useTimetableStore } from '../store/timetableStore';
import { AvailabilityBasis, batchAvailability, sectionCodes } from '../lib/batchAvailability';
import { formatDuration, TIMELINE_STEP_MINUTES } from '../lib/timeline';
import { minutesToTimeString } from '../lib/utils';
import { Combobox } from './Combobox';

const fmt = minutesToTimeString;
const DAY_START = 8 * 60 + 30;
const DAY_END = 17 * 60 + 15;
const EVENING_END = 20 * 60 + 15;

/** Req H: common free time across several sections, with rooms free for each window. */
export const BatchAvailabilityModal: React.FC = () => {
  const { isOpen, close, courses, allocations, students, rooms } = useTimetableStore(
    useShallow((s) => ({
      isOpen: s.isBatchAvailabilityOpen,
      close: s.closeBatchAvailability,
      courses: s.courses,
      allocations: s.allocations,
      students: s.students,
      rooms: s.rooms,
    }))
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [prefix, setPrefix] = useState('');
  const [basis, setBasis] = useState<AvailabilityBasis>('students');
  const [minDuration, setMinDuration] = useState(55);
  const [maxBusy, setMaxBusy] = useState(0);
  const [includeEvening, setIncludeEvening] = useState(false);
  const [openWindow, setOpenWindow] = useState<string | null>(null);

  const allSections = useMemo(() => sectionCodes(courses), [courses]);
  const sectionOptions = useMemo(
    () =>
      allSections
        .filter((s) => !selected.includes(s))
        .map((s) => ({ value: s, label: s, detail: `${courses.filter((c) => c.section === s).length} courses` })),
    [allSections, selected, courses]
  );
  const prefixMatches = useMemo(() => {
    const p = prefix.trim().toUpperCase();
    return p.length < 2 ? [] : allSections.filter((s) => s.toUpperCase().startsWith(p) && !selected.includes(s));
  }, [prefix, allSections, selected]);

  const dayEnd = includeEvening ? EVENING_END : DAY_END;
  const result = useMemo(() => {
    if (!isOpen || selected.length === 0) return null;
    return batchAvailability({
      sections: selected,
      basis,
      allocations,
      courses,
      students,
      rooms,
      dayStart: DAY_START,
      dayEnd,
      maxBusy,
      minDuration,
    });
  }, [isOpen, selected, basis, allocations, courses, students, rooms, dayEnd, maxBusy, minDuration]);

  if (!isOpen) return null;

  const totalWindows = result?.days.reduce((n, d) => n + d.windows.length, 0) || 0;
  const unitLabel = basis === 'students' ? 'student' : 'section';
  const ticks = Math.ceil((dayEnd - DAY_START) / TIMELINE_STEP_MINUTES);
  const hourMarks: number[] = [];
  for (let h = Math.ceil(DAY_START / 60) * 60; h < dayEnd; h += 60) hourMarks.push(h);

  const segClass = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
      active ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={close}>
      <div
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-zinc-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Users className="w-5 h-5 mt-0.5 text-blue-600 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Common free time</h3>
              <p className="text-xs text-gray-500">
                Pick several sections (e.g. BCS-1A to 1D) to see exactly when all of them are free together, to the 5 minutes, and
                which rooms are free then.
              </p>
            </div>
          </div>
          <button onClick={close} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Section picker and options */}
        <div className="p-4 sm:px-5 border-b border-gray-200 dark:border-zinc-800 flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Combobox
              options={sectionOptions}
              value=""
              onChange={(s) => setSelected((prev) => (prev.includes(s) ? prev : [...prev, s]))}
              ariaLabel="Add a section"
              placeholder="Add a section, e.g. BCS-1A…"
              inputClassName="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Or add all starting with… (BCS-1)"
                aria-label="Add all sections starting with"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                disabled={prefixMatches.length === 0}
                onClick={() => {
                  setSelected((prev) => [...prev, ...prefixMatches]);
                  setPrefix('');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add {prefixMatches.length || ''}
              </button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selected.map((s) => (
                <span key={s} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 font-bold border border-blue-200 dark:border-blue-900">
                  {s}
                  <button aria-label={`Remove ${s}`} onClick={() => setSelected((prev) => prev.filter((x) => x !== s))} className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button onClick={() => setSelected([])} className="text-gray-500 hover:underline ml-1">
                Clear all
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-500">Check</span>
              <div className="flex gap-0.5 bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                <button className={segClass(basis === 'students')} onClick={() => setBasis('students')} title="Every enrolled student's full timetable, including courses taken with other sections">
                  Every student
                </button>
                <button className={segClass(basis === 'sections')} onClick={() => setBasis('sections')} title="Only the classes timetabled for these sections">
                  Section timetable
                </button>
              </div>
            </div>
            <label className="flex items-center gap-1.5">
              <span className="font-bold text-gray-500">At least</span>
              <select value={minDuration} onChange={(e) => setMinDuration(Number(e.target.value))} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                {[30, 55, 60, 80, 105, 120, 165].map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="font-bold text-gray-500">Allow</span>
              <select value={maxBusy} onChange={(e) => setMaxBusy(Number(e.target.value))} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                {[0, 1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? `no clashes` : `up to ${n} busy ${unitLabel}${n > 1 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeEvening} onChange={(e) => setIncludeEvening(e.target.checked)} />
              Include evenings (to 20:15)
            </label>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-5 flex flex-col gap-3">
          {!result ? (
            <p className="py-10 text-center text-sm text-gray-500">Add two or more sections to find their common free time.</p>
          ) : (
            <>
              <p className="shrink-0 text-xs text-gray-600 dark:text-gray-400">
                Checking <strong>{result.population}</strong> {result.unit} across {selected.length} section{selected.length === 1 ? '' : 's'},{' '}
                {fmt(DAY_START)}–{fmt(dayEnd)}: <strong>{totalWindows}</strong> window{totalWindows === 1 ? '' : 's'} of at least{' '}
                {formatDuration(minDuration)}
                {maxBusy > 0 ? ` with at most ${maxBusy} busy` : ' with everyone free'}.
              </p>

              {result.days.map(({ day, profile, windows }) => {
                const peak = Math.max(1, ...profile);
                return (
                  <div key={day} className="shrink-0 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{day}</span>
                      <span className="text-[11px] text-gray-500">
                        {windows.length === 0 ? 'No common free time' : `${windows.length} free window${windows.length === 1 ? '' : 's'}`}
                      </span>
                    </div>

                    {/* Day bar: green = free for everyone, darker red = more people busy */}
                    <div className="px-3 pt-2">
                      <div className="relative h-5 flex rounded overflow-hidden" aria-hidden>
                        {profile.map((busy, t) => (
                          <div
                            key={t}
                            className="h-full"
                            style={{
                              width: `${100 / ticks}%`,
                              background:
                                busy === 0
                                  ? '#34d399'
                                  : busy <= maxBusy
                                  ? '#fcd34d'
                                  : `rgba(244, 63, 94, ${0.25 + 0.75 * (busy / peak)})`,
                            }}
                            title={`${fmt(DAY_START + t * TIMELINE_STEP_MINUTES)}: ${busy} ${unitLabel}${busy === 1 ? '' : 's'} busy`}
                          />
                        ))}
                      </div>
                      <div className="relative h-4 text-[9px] text-gray-400 font-mono">
                        {hourMarks.map((h) => (
                          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - DAY_START) / (dayEnd - DAY_START)) * 100}%` }}>
                            {fmt(h)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {windows.length > 0 && (
                      <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {windows.map((w) => {
                          const key = `${day}-${w.startMinutes}`;
                          const expanded = openWindow === key;
                          return (
                            <li key={key} className="px-3 py-2 text-xs">
                              <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpenWindow(expanded ? null : key)}>
                                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                  {fmt(w.startMinutes)}–{fmt(w.endMinutes)}
                                </span>
                                <span className="text-gray-500">{formatDuration(w.endMinutes - w.startMinutes)}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-semibold ${
                                    w.busy === 0
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  {w.busy === 0 ? 'everyone free' : `up to ${w.busy} busy`}
                                </span>
                                <span className="ml-auto flex items-center gap-1 text-gray-500 shrink-0">
                                  <DoorOpen className="w-3.5 h-3.5" />
                                  {w.freeRooms.length} rooms free
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                </span>
                              </button>
                              {expanded && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {w.freeRooms.length === 0 ? (
                                    <span className="text-gray-500">No room is free for the whole window.</span>
                                  ) : (
                                    w.freeRooms.map((r) => (
                                      <span
                                        key={r.id}
                                        className={`px-1.5 py-0.5 rounded border ${
                                          r.capacity > 0 && r.capacity < result.population && basis === 'students'
                                            ? 'border-gray-200 dark:border-zinc-700 text-gray-400'
                                            : 'border-emerald-200 dark:border-emerald-900 text-gray-800 dark:text-gray-200'
                                        }`}
                                        title={`${r.type} · ${r.capacity || '?'} seats · ${r.building}`}
                                      >
                                        {r.name} <span className="text-gray-400">{r.capacity || '?'}</span>
                                      </span>
                                    ))
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="px-4 sm:px-5 py-2 border-t border-gray-200 dark:border-zinc-800 text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> everyone free</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block" /> within your allowance</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" /> busy (darker = more people)</span>
          <span>Rooms in grey have fewer seats than the students being checked.</span>
        </div>
      </div>
    </div>
  );
};
