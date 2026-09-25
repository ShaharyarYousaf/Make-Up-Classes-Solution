import { Allocation, CourseSection, Room, Student } from '../types/timetable';
import { REAL_ROOMS, REAL_COURSES, REAL_ALLOCATIONS } from './realTimetableData';
import studentRoster from '../../data/students_roster.json';

export const INITIAL_ROOMS: Room[] = REAL_ROOMS;
export const INITIAL_COURSES: CourseSection[] = REAL_COURSES;
export const INITIAL_ALLOCATIONS: Allocation[] = REAL_ALLOCATIONS;
export const INITIAL_STUDENTS: Student[] = studentRoster as Student[];
