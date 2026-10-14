import { CourseSection } from '../types/timetable';
import type { ComboboxOption } from '../components/Combobox';

/** One option per course code; sections and teachers are searchable too. */
export function courseCodeOptions(courses: CourseSection[]): ComboboxOption[] {
  const byCode = new Map<string, CourseSection[]>();
  for (const c of courses) {
    const list = byCode.get(c.courseCode);
    if (list) list.push(c);
    else byCode.set(c.courseCode, [c]);
  }
  return Array.from(byCode.entries()).map(([code, sections]) => ({
    value: code,
    label: `${code} – ${sections[0].courseTitle}`,
    detail: `${sections.length} section${sections.length > 1 ? 's' : ''} · ${sections[0].department}`,
    keywords: sections.map((s) => `${s.section} ${s.instructor}`).join(' '),
  }));
}

/** The sections of one course code, with their teacher. */
export function sectionOptions(courses: CourseSection[], courseCode: string): ComboboxOption[] {
  return courses
    .filter((c) => c.courseCode === courseCode)
    .map((c) => ({ value: c.section, label: c.section, detail: c.instructor }));
}
