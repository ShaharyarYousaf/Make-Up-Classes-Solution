import { Allocation, CourseSection } from '../types/timetable';
import { isReservedAllocation } from './csvParser';
import { allocationInterval } from './timeline';

const LAB_TITLE = /\blab\b/i;
/** Courses that usually have no fixed weekly class */
const NO_CLASS_TITLE = /final year project|\bfyp\b|thesis|internship|independent study|\bproject\b/i;

export const isLabSection = (course: CourseSection) => LAB_TITLE.test(course.courseTitle);
export const isProjectLike = (course: CourseSection) => NO_CLASS_TITLE.test(course.courseTitle);

/**
 * Weekly class time a section normally gets: 50 minutes per credit hour for theory
 * (3 Cr = 2 × 80 min, 1 Cr = 55 min), one 165-minute block for a lab.
 */
export function expectedWeeklyMinutes(course: CourseSection): number {
  return isLabSection(course) ? 150 : Math.max(1, course.creditHours) * 50;
}

/** Suggested length of one session when scheduling this section. */
export function defaultSessionMinutes(course: CourseSection): number {
  if (isLabSection(course)) return 165;
  return course.creditHours <= 1 ? 55 : 80;
}

/** Scheduled minutes per week for every section that has at least one class. */
export function scheduledMinutesBySection(allocations: Allocation[]): Map<string, number> {
  const minutes = new Map<string, number>();
  for (const a of allocations) {
    if (isReservedAllocation(a.courseSectionId)) continue;
    const i = allocationInterval(a);
    minutes.set(a.courseSectionId, (minutes.get(a.courseSectionId) || 0) + (i.endMinutes - i.startMinutes));
  }
  return minutes;
}

/** Below this share of the expected weekly time a section counts as "short on time" */
export const SHORT_ON_TIME_RATIO = 0.9;
