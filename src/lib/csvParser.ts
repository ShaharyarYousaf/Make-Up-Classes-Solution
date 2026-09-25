import { Allocation, CourseSection, DayOfWeek, Room, Student } from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from './constants';

/**
 * Robust CSV Line Splitter that handles quoted fields with commas and newlines
 */
export function parseCSVText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentToken = '';

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentToken.trim());
      currentToken = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(currentToken.trim());
      if (row.some(field => field.length > 0)) {
        lines.push(row);
      }
      row = [];
      currentToken = '';
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0 || row.length > 0) {
    row.push(currentToken.trim());
    if (row.some(field => field.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Normalizes headers (lowercase, trimmed, strip non-alphanumeric)
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses Student Enrollments CSV:
 * Expected headers: Student ID, Student Name, Course Section Code (or Course Section)
 */
export function parseStudentsCSV(csvText: string): Student[] {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const idIdx = headers.findIndex(h => h.includes('studentid') || h === 'id' || h.includes('rollno') || h.includes('regno'));
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('studentname'));
  const sectionIdx = headers.findIndex(h => h.includes('section') || h.includes('course') || h.includes('code'));

  const studentMap = new Map<string, Student>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = (idIdx !== -1 ? row[idIdx] : row[0])?.trim();
    const name = (nameIdx !== -1 ? row[nameIdx] : row[1])?.trim() || 'Student ' + id;
    const section = (sectionIdx !== -1 ? row[sectionIdx] : row[2])?.trim();

    if (!id || !section) continue;

    if (!studentMap.has(id)) {
      studentMap.set(id, {
        id,
        name,
        enrolledSectionIds: [section],
        degreeProgram: 'BS Computer Science',
        batch: id.split('-')[0] || '2021',
      });
    } else {
      const existing = studentMap.get(id)!;
      if (!existing.enrolledSectionIds.includes(section)) {
        existing.enrolledSectionIds.push(section);
      }
    }
  }

  return Array.from(studentMap.values());
}

/**
 * Parses Courses CSV:
 * Expected headers: Course Code, Course Title, Section, Department, Instructor, Credit Hours
 */
export function parseCoursesCSV(csvText: string): CourseSection[] {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const codeIdx = headers.findIndex(h => h.includes('coursecode') || h === 'code');
  const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('coursename') || h.includes('name'));
  const secIdx = headers.findIndex(h => h.includes('section') || h.includes('sec'));
  const deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept'));
  const instIdx = headers.findIndex(h => h.includes('instructor') || h.includes('teacher') || h.includes('faculty'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('cr'));

  const colors = [
    { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200', badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200', accent: 'emerald' },
    { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-900 dark:text-blue-200', badge: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200', accent: 'blue' },
    { bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-900 dark:text-indigo-200', badge: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200', accent: 'indigo' },
    { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200', accent: 'purple' },
    { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200', accent: 'amber' },
    { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-900 dark:text-cyan-200', badge: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200', accent: 'cyan' },
  ];

  const courses: CourseSection[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const code = (codeIdx !== -1 ? row[codeIdx] : row[0])?.trim();
    const title = (titleIdx !== -1 ? row[titleIdx] : row[1])?.trim() || code;
    const section = (secIdx !== -1 ? row[secIdx] : row[2])?.trim() || 'A';
    const dept = (deptIdx !== -1 ? row[deptIdx] : row[3])?.trim() || 'Computer Science';
    const instructor = (instIdx !== -1 ? row[instIdx] : row[4])?.trim() || 'Faculty';
    const credits = Number(creditIdx !== -1 ? row[creditIdx] : row[5]) || 3;

    if (!code) continue;

    const id = `${code} ${section}`;
    const color = colors[courses.length % colors.length];

    courses.push({
      id,
      courseCode: code,
      courseTitle: title,
      section,
      department: dept,
      creditHours: credits,
      instructor,
      color,
    });
  }

  return courses;
}

/**
 * Parses Timetable Allocations CSV:
 * Expected headers: Day, TimeSlot (or Slot Number / Slot ID), Room, Course Section
 */
export function parseTimetableCSV(csvText: string, existingRooms: Room[]): Allocation[] {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const dayIdx = headers.findIndex(h => h.includes('day'));
  const slotIdx = headers.findIndex(h => h.includes('slot') || h.includes('time'));
  const roomIdx = headers.findIndex(h => h.includes('room'));
  const courseIdx = headers.findIndex(h => h.includes('course') || h.includes('section'));

  const allocations: Allocation[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawDay = (dayIdx !== -1 ? row[dayIdx] : row[0])?.trim();
    const rawSlot = (slotIdx !== -1 ? row[slotIdx] : row[1])?.trim();
    const rawRoom = (roomIdx !== -1 ? row[roomIdx] : row[2])?.trim();
    const rawCourse = (courseIdx !== -1 ? row[courseIdx] : row[3])?.trim();

    if (!rawDay || !rawSlot || !rawRoom || !rawCourse) continue;

    // Match Day
    const day = DAYS_OF_WEEK.find(d => d.toLowerCase() === rawDay.toLowerCase()) || 'Monday';

    // Match Slot (Exact ID, Lab token, or slot number)
    let slotId = 'slot-1';
    const cleanSlot = rawSlot.trim().toLowerCase();

    // 1. Direct ID match (e.g. 'slot-1', 'lab-1', 'lab-2', 'lab-3', 'lab-4')
    const directMatch = STANDARD_TIME_SLOTS.find(s => s.id.toLowerCase() === cleanSlot);
    if (directMatch) {
      slotId = directMatch.id;
    } else {
      // 2. Lab token match (e.g. 'Lab 1', 'Lab-1', 'Lab 2', 'Lab 3')
      const labMatch = cleanSlot.match(/^lab[- ]?(\d+)$/i);
      if (labMatch) {
        const labIndex = parseInt(labMatch[1], 10);
        const labSlotNum = labIndex + 8; // Lab 1 -> 9, Lab 2 -> 10, Lab 3 -> 11, Lab 4 -> 12
        const slotByNum = STANDARD_TIME_SLOTS.find(s => s.slotNumber === labSlotNum);
        if (slotByNum) slotId = slotByNum.id;
      } else {
        // 3. Slot number match (e.g. 'Slot 10', 'Slot-11', '10', '11')
        const slotNumMatch = cleanSlot.match(/^slot[- ]?(\d+)$/i) || cleanSlot.match(/^(\d+)$/);
        if (slotNumMatch) {
          const num = parseInt(slotNumMatch[1], 10);
          const slotByNum = STANDARD_TIME_SLOTS.find(s => s.slotNumber === num);
          if (slotByNum) slotId = slotByNum.id;
        } else {
          // 4. Label match fallback
          const labelMatch = STANDARD_TIME_SLOTS.find(s => s.label.toLowerCase().includes(cleanSlot));
          if (labelMatch) slotId = labelMatch.id;
        }
      }
    }

    // Match Room ID
    let roomId = rawRoom;
    const roomMatch = existingRooms.find(r =>
      r.id.toLowerCase() === rawRoom.toLowerCase() ||
      r.name.toLowerCase() === rawRoom.toLowerCase()
    );
    if (roomMatch) {
      roomId = roomMatch.id;
    }

    allocations.push({
      id: `alloc-import-${Date.now()}-${i}`,
      courseSectionId: rawCourse,
      day,
      slotId,
      roomId,
      allocatedAt: new Date().toISOString(),
    });
  }

  return allocations;
}

/**
 * Generates ready-to-fill CSV templates
 */
export const SAMPLE_STUDENTS_CSV = `Student ID,Student Name,Course Section Code
21I-0412,Syed Umar Javed,AI4015 BCS-7B
21I-0412,Syed Umar Javed,CS3001 BAI-5A
20I-0830,Salar Shoaib Abbasi,AI4015 BCS-7B
20I-0830,Salar Shoaib Abbasi,CS3001 BAI-5A
20I-0830,Salar Shoaib Abbasi,SE3002 BSE-6A
21I-1149,Hamza Tariq,AI4015 BCS-7B
21I-0592,Fatima Noor,AI4015 BCS-7B
20I-0671,Bilal Ahmed Khan,AI4015 BCS-7B
20I-0671,Bilal Ahmed Khan,CS3001 BAI-5A
`;

export const SAMPLE_COURSES_CSV = `Course Code,Course Title,Section,Department,Instructor,Credit Hours
AI4015,Agentic Artificial Intelligence,BCS-7B,Artificial Intelligence,Dr. Zeeshan Ali,3
CS3001,Database Systems,BAI-5A,Computer Science,Dr. Nadia Farooq,3
CS2005,Data Structures & Algorithms,BCS-3A,Computer Science,Prof. Usman Tariq,3
SE3002,Software Engineering Process,BSE-6A,Software Engineering,Dr. Kashif Munir,3
CS4001,Cloud Computing Architecture,BCS-7B,Computer Science,Dr. Arshad Mehmood,3
`;

export const SAMPLE_TIMETABLE_CSV = `Day,TimeSlot,Room,Course Section
Monday,Slot 2,Room A-1,AI4015 BCS-7B
Monday,Slot 4,CS-101,CS3001 BAI-5A
Tuesday,Slot 3,Room A-1,CS4001 BCS-7B
Wednesday,Slot 2,Room A-1,AI4015 BCS-7B
Wednesday,Slot 4,CS-102,SE3002 BSE-6A
`;
