// Automatically loaded from parsed university timetable JSON dataset
import { Allocation, CourseSection, Room } from '../types/timetable';
import realData from '../../data/real_timetable_data.json';

export const REAL_ROOMS: Room[] = realData.rooms as Room[];
export const REAL_COURSES: CourseSection[] = realData.courses as CourseSection[];
export const REAL_ALLOCATIONS: Allocation[] = realData.allocations as unknown as Allocation[];
