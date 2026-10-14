import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CalendarPlus, CalendarX, Search, Users, X } from 'lucide-react';
import { useTimetableStore } from '../store/timetableStore';
import { getSectionRoster } from '../lib/engine';
import {
  SHORT_ON_TIME_RATIO,
  defaultSessionMinutes,
  expectedWeeklyMinutes,
  isLabSection,
  isProjectLike,
  scheduledMinutesBySection,
} from '../lib/courseLoad';
import { formatDuration } from '../lib/timeline';
import { CourseSection } from '../types/timetable';

type Tab = 'none' | 'short';

interface Row {
  course: CourseSection;
  scheduled: number;
  expected: number;
  enrolled: number;
}

/** Req E: sections with no class (or too little class time) on the timetable, and a way to schedule them. */
export const UnscheduledCoursesModal: React.FC = () => {
  const { isOpen, close, courses, allocations, students, openFlexibleModal } = useTimetableStore(
    useShallow((s) => ({
      isOpen: s.isUnscheduledOpen,
      close: s.closeUnscheduled,
      courses: s.courses,
      allocations: s.allocations,
      students: s.students,
      openFlexibleModal: s.openFlexibleModal,
    }))
  );

  const [tab, setTab] = useState<Tab>('none');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [hideProjects, setHideProjects] = useState(true);

  const { none, short } = useMemo(() => {
    const minutes = scheduledMinutesBySection(allocations);
    const roster = getSectionRoster(students);
    const none: Row[] = [];
    const short: Row[] = [];
    for (const course of courses) {
      const row: Row = {
        course,
        scheduled: minutes.get(course.id) || 0,
        expected: expectedWeeklyMinutes(course),
        enrolled: roster.get(course.id)?.length || 0,
      };
      if (row.scheduled === 0) none.push(row);
      else if (row.scheduled < row.expected * SHORT_ON_TIME_RATIO) short.push(row);
    }
    // Sections with the most students first: they matter most
    const byEnrolled = (a: Row, b: Row) => b.enrolled - a.enrolled || a.course.id.localeCompare(b.course.id);
    return { none: none.sort(byEnrolled), short: short.sort(byEnrolled) };
  }, [courses, allocations, students]);

  const departments = useMemo(() => Array.from(new Set(courses.map((c) => c.department))).sort(), [courses]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === 'none' ? none : short).filter(({ course }) => {
      if (hideProjects && isProjectLike(course)) return false;
      if (department !== 'ALL' && course.department !== department) return false;
      if (!q) return true;
      return [course.courseCode, course.courseTitle, course.section, course.instructor].some((v) => v.toLowerCase().includes(q));
    });
  }, [tab, none, short, query, department, hideProjects]);

  const hiddenProjects = (tab === 'none' ? none : short).filter((r) => isProjectLike(r.course)).length;

  if (!isOpen) return null;

  const tabClass = (active: boolean) =>
    `flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
      active ? 'bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={close}>
      <div
        className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-zinc-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CalendarX className="w-5 h-5 mt-0.5 text-blue-600 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Unscheduled courses</h3>
              <p className="text-xs text-gray-500">
                Sections with no class on the timetable, or less weekly class time than their credit hours need. Click{' '}
                <strong>Schedule</strong> to find a clash-free slot and add a regular weekly class.
              </p>
            </div>
          </div>
          <button onClick={close} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 sm:px-5 flex flex-col gap-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button className={tabClass(tab === 'none')} onClick={() => setTab('none')}>
              Not scheduled ({none.length})
            </button>
            <button className={tabClass(tab === 'short')} onClick={() => setTab('short')}>
              Short on time ({short.length})
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Code, title, section or teacher…"
                aria-label="Search unscheduled courses"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Department"
              className="max-w-[45vw] px-2 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
            >
              <option value="ALL">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
              <input type="checkbox" checked={hideProjects} onChange={(e) => setHideProjects(e.target.checked)} />
              Hide FYP / thesis / project{hiddenProjects > 0 ? ` (${hiddenProjects})` : ''}
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              {tab === 'none' ? 'Every section matching these filters has a class.' : 'No section is short on class time.'}
            </p>
          ) : (
            rows.map(({ course, scheduled, expected, enrolled }) => (
              <div key={course.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-extrabold text-gray-900 dark:text-white">{course.courseCode}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${course.color.badge}`}>{course.section}</span>
                    {isLabSection(course) && (
                      <span className="text-[9px] font-bold px-1 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200">Lab</span>
                    )}
                    <span className="text-[11px] text-gray-500">{course.creditHours} Cr</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{course.courseTitle}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {course.instructor} · {course.department}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end text-[11px] text-gray-500 shrink-0">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {enrolled} students
                  </span>
                  <span>
                    {tab === 'short' ? `${formatDuration(scheduled)} of ~${formatDuration(expected)} / week` : `needs ~${formatDuration(expected)} / week`}
                  </span>
                </div>
                <button
                  onClick={() => openFlexibleModal(course.id, undefined, 'schedule')}
                  title={`Find a clash-free ${defaultSessionMinutes(course)}-minute slot for ${course.courseCode} ${course.section}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Schedule
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-4 sm:px-5 py-2 border-t border-gray-200 dark:border-zinc-800 text-[11px] text-gray-500">
          Showing {rows.length} section{rows.length === 1 ? '' : 's'}, most students first. Weekly time is estimated from credit hours
          (3 Cr ≈ 2 × 80 min, labs ≈ one 2h 45m block).
        </div>
      </div>
    </div>
  );
};
