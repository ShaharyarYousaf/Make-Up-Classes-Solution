import { Allocation, CourseSection, Room, RoomType, Student } from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from './constants';
import { getInstructorNames } from './engine';

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

export interface ImportReport {
  imported: number;
  skipped: number;
  /** Rows that were rejected */
  errors: string[];
  /** Rows that were imported but need attention */
  warnings: string[];
  /** Neutral information (e.g. empty cells ignored) */
  info: string[];
}

export interface ParseResult<T> {
  items: T[];
  report: ImportReport;
}

const EMPTY_REPORT: ImportReport = { imported: 0, skipped: 0, errors: [], warnings: [], info: [] };

/** Groups row issues by reason so a 2,000-row file produces a short, readable report. */
class IssueCollector {
  private groups = new Map<string, { count: number; examples: string[] }>();

  add(reason: string, example: string) {
    let group = this.groups.get(reason);
    if (!group) {
      group = { count: 0, examples: [] };
      this.groups.set(reason, group);
    }
    group.count++;
    if (group.examples.length < 3) group.examples.push(example);
  }

  get total() {
    let total = 0;
    this.groups.forEach(g => (total += g.count));
    return total;
  }

  toMessages(): string[] {
    return Array.from(this.groups.entries()).map(
      ([reason, g]) => `${reason}: ${g.count} row${g.count > 1 ? 's' : ''} (e.g. ${g.examples.join('; ')})`
    );
  }
}

/** Timetable cells that reserve a room without being a class (e.g. "Prayer break") */
export const RESERVED_PREFIX = '__reserved__:';
const RESERVED_PATTERN = /^(prayer|namaz|jumm?a|break|lunch|reserved|blocked|closed)\b/i;
// Spreadsheet error values such as #N/A, #REF!, #VALUE!
const SPREADSHEET_ERROR_PATTERN = /^#[A-Z0-9/!?]+/i;

export function isReservedAllocation(courseSectionId: string): boolean {
  return courseSectionId.startsWith(RESERVED_PREFIX);
}

export function getReservedLabel(courseSectionId: string): string {
  return courseSectionId.slice(RESERVED_PREFIX.length);
}

/**
 * Parses Student Enrollments CSV:
 * Expected headers: Student ID, Student Name, Course Section Code (or Course Section)
 */
export function parseStudentsCSV(csvText: string, knownCourses: CourseSection[] = []): ParseResult<Student> {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return { items: [], report: EMPTY_REPORT };
  const errors = new IssueCollector();
  const warnings = new IssueCollector();

  const headers = rows[0].map(normalizeHeader);
  const idIdx = headers.findIndex(h => h.includes('studentid') || h === 'id' || h.includes('rollno') || h.includes('regno'));
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('studentname'));
  const sectionIdx = headers.findIndex(h => h.includes('section') || h.includes('course') || h.includes('code'));

  const knownCourseIds = new Set(knownCourses.map(c => c.id));
  const studentMap = new Map<string, Student>();
  let enrollmentRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    // Roll numbers are case-insensitive (20i-0830 == 20I-0830)
    const id = (idIdx !== -1 ? row[idIdx] : row[0])?.trim().toUpperCase();
    const name = (nameIdx !== -1 ? row[nameIdx] : row[1])?.trim() || 'Student ' + id;
    const section = (sectionIdx !== -1 ? row[sectionIdx] : row[2])?.trim().replace(/\s+/g, ' ');

    if (!id || !section) {
      errors.add('Missing student ID or course section', `line ${line}`);
      continue;
    }

    if (knownCourseIds.size > 0 && !knownCourseIds.has(section)) {
      warnings.add('Section not in course list (clashes still checked)', `line ${line}: ${section}`);
    }

    enrollmentRows++;
    const batchMatch = id.match(/^(\d{2})/);
    if (!studentMap.has(id)) {
      studentMap.set(id, {
        id,
        name,
        enrolledSectionIds: [section],
        degreeProgram: 'BS Computer Science',
        batch: batchMatch ? `20${batchMatch[1]}` : '',
      });
    } else {
      const existing = studentMap.get(id)!;
      if (!existing.enrolledSectionIds.includes(section)) {
        existing.enrolledSectionIds.push(section);
      }
    }
  }

  const items = Array.from(studentMap.values());
  return {
    items,
    report: {
      imported: items.length,
      skipped: errors.total,
      errors: errors.toMessages(),
      warnings: warnings.toMessages(),
      info: [`${enrollmentRows} enrollment rows grouped into ${items.length} students`],
    },
  };
}

const COURSE_COLORS = [
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200', badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200', accent: 'emerald' },
  { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-900 dark:text-blue-200', badge: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200', accent: 'blue' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-900 dark:text-indigo-200', badge: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200', accent: 'indigo' },
  { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200', accent: 'purple' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200', accent: 'amber' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-900 dark:text-cyan-200', badge: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200', accent: 'cyan' },
];

/**
 * Parses Courses CSV:
 * Expected headers: Course Code, Course Title, Section, Department, Instructor, Credit Hours
 */
export function parseCoursesCSV(csvText: string): ParseResult<CourseSection> {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return { items: [], report: EMPTY_REPORT };
  const errors = new IssueCollector();
  const warnings = new IssueCollector();

  const headers = rows[0].map(normalizeHeader);
  const codeIdx = headers.findIndex(h => h.includes('coursecode') || h === 'code');
  const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('coursename') || h.includes('name'));
  const secIdx = headers.findIndex(h => h.includes('section') || h.includes('sec'));
  const deptIdx = headers.findIndex(h => h.includes('department') || h.includes('dept'));
  const instIdx = headers.findIndex(h => h.includes('instructor') || h.includes('teacher') || h.includes('faculty'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('cr'));

  const courses: CourseSection[] = [];
  const seenIds = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const code = (codeIdx !== -1 ? row[codeIdx] : row[0])?.trim();
    const title = (titleIdx !== -1 ? row[titleIdx] : row[1])?.trim() || code;
    const section = (secIdx !== -1 ? row[secIdx] : row[2])?.trim() || 'A';
    const dept = (deptIdx !== -1 ? row[deptIdx] : row[3])?.trim() || 'Computer Science';
    const instructor = (instIdx !== -1 ? row[instIdx] : row[4])?.trim() || 'Faculty';
    const credits = Number(creditIdx !== -1 ? row[creditIdx] : row[5]) || 3;

    if (!code || SPREADSHEET_ERROR_PATTERN.test(code)) {
      errors.add('Missing or invalid course code', `line ${line}`);
      continue;
    }

    const id = `${code} ${section}`;
    if (seenIds.has(id)) {
      warnings.add('Duplicate course section (first row kept)', `line ${line}: ${id}`);
      continue;
    }
    seenIds.add(id);

    if (getInstructorNames(instructor).length === 0) {
      warnings.add('No instructor assigned (teacher clash check skipped)', `line ${line}: ${id}`);
    }

    const color = COURSE_COLORS[courses.length % COURSE_COLORS.length];

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

  return {
    items: courses,
    report: {
      imported: courses.length,
      skipped: errors.total,
      errors: errors.toMessages(),
      warnings: warnings.toMessages(),
      info: [],
    },
  };
}

/**
 * Matches a slot cell such as "Slot 3", "slot-3", "3", "Lab Morning" or "08:30".
 * Numbers are matched exactly, so "Slot 10" never falls back to Slot 1.
 */
function matchSlot(rawSlot: string) {
  const value = rawSlot.trim().toLowerCase();
  const byId = STANDARD_TIME_SLOTS.find(s => s.id === value);
  if (byId) return byId;

  const numberMatch = value.match(/^(?:slot\s*-?\s*)?(\d{1,2})$/);
  if (numberMatch) {
    return STANDARD_TIME_SLOTS.find(s => s.slotNumber === Number(numberMatch[1]));
  }

  // Lab token: "Lab 1" -> slot 9 (lab-1), ..., "Lab 4" -> slot 12 (lab-4)
  const labMatch = value.match(/^lab\s*-?\s*(\d)$/);
  if (labMatch) {
    return STANDARD_TIME_SLOTS.find(s => s.slotNumber === Number(labMatch[1]) + 8);
  }

  const byLabel = STANDARD_TIME_SLOTS.find(s => {
    const label = s.label.toLowerCase();
    return label === value || label.startsWith(value + ' ');
  });
  if (byLabel) return byLabel;

  const timeMatch = value.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const start = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    return STANDARD_TIME_SLOTS.find(s => s.startTime === start);
  }
  return undefined;
}

function slugifyRoomId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room';
}

function guessRoomType(name: string): RoomType {
  return /\blab\b/i.test(name) ? 'Lab' : 'Lecture';
}

export interface TimetableParseResult extends ParseResult<Allocation> {
  /** Rooms referenced by the timetable that did not exist yet */
  newRooms: Room[];
}

/**
 * Parses Timetable Allocations CSV:
 * Expected headers: Day, TimeSlot (or Slot Number / Slot ID), Room, Course Section
 */
export function parseTimetableCSV(
  csvText: string,
  existingRooms: Room[],
  knownCourses: CourseSection[] = []
): TimetableParseResult {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return { items: [], newRooms: [], report: EMPTY_REPORT };
  const errors = new IssueCollector();
  const warnings = new IssueCollector();

  const headers = rows[0].map(normalizeHeader);
  const dayIdx = headers.findIndex(h => h.includes('day'));
  const slotIdx = headers.findIndex(h => h.includes('slot') || h.includes('time'));
  const roomIdx = headers.findIndex(h => h.includes('room'));
  const courseIdx = headers.findIndex(h => h.includes('course') || h.includes('section'));

  const roomLookup = new Map<string, Room>();
  for (const room of existingRooms) {
    roomLookup.set(room.id.toLowerCase(), room);
    roomLookup.set(room.name.toLowerCase(), room);
  }
  const newRooms: Room[] = [];
  const knownCourseIds = new Set(knownCourses.map(c => c.id));
  const occupiedCells = new Map<string, string>();

  const allocations: Allocation[] = [];
  const importStamp = Date.now();
  let emptyCells = 0;
  let reservedCells = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const rawDay = (dayIdx !== -1 ? row[dayIdx] : row[0])?.trim();
    const rawSlot = (slotIdx !== -1 ? row[slotIdx] : row[1])?.trim();
    const rawRoom = (roomIdx !== -1 ? row[roomIdx] : row[2])?.trim();
    const rawCourse = (courseIdx !== -1 ? row[courseIdx] : row[3])?.trim().replace(/\s+/g, ' ');
    const where = `line ${line}: ${rawDay || '?'} ${rawSlot || '?'} ${rawRoom || '?'}`;

    // A blank course cell is just a free room in a full grid export
    if (!rawCourse) {
      emptyCells++;
      continue;
    }
    if (!rawDay || !rawSlot || !rawRoom) {
      errors.add('Missing day, slot or room', where);
      continue;
    }
    if (SPREADSHEET_ERROR_PATTERN.test(rawCourse)) {
      errors.add(`Spreadsheet error "${rawCourse}" instead of a course (fix it in the source sheet)`, where);
      continue;
    }

    const day = DAYS_OF_WEEK.find(d => d.toLowerCase() === rawDay.toLowerCase());
    if (!day) {
      errors.add('Unrecognised day', `${where} ("${rawDay}")`);
      continue;
    }

    const slot = matchSlot(rawSlot);
    if (!slot) {
      errors.add('Unrecognised time slot', `${where} ("${rawSlot}")`);
      continue;
    }

    let room = roomLookup.get(rawRoom.toLowerCase());
    if (!room) {
      let id = slugifyRoomId(rawRoom);
      while (roomLookup.has(id)) id += '-x';
      room = { id, name: rawRoom, type: guessRoomType(rawRoom), capacity: 0, building: 'Unknown' };
      roomLookup.set(id, room);
      roomLookup.set(rawRoom.toLowerCase(), room);
      newRooms.push(room);
    }

    let courseSectionId = rawCourse;
    if (RESERVED_PATTERN.test(rawCourse)) {
      courseSectionId = `${RESERVED_PREFIX}${rawCourse}`;
      reservedCells++;
    } else if (knownCourseIds.size > 0 && !knownCourseIds.has(rawCourse)) {
      warnings.add('Course section not in course list (kept so the room stays blocked)', `${where} → ${rawCourse}`);
    }

    const cellKey = `${day}|${slot.id}|${room.id}`;
    const previous = occupiedCells.get(cellKey);
    if (previous) {
      warnings.add('Room double-booked in the source file', `${where}: ${previous} and ${rawCourse}`);
    } else {
      occupiedCells.set(cellKey, rawCourse);
    }

    allocations.push({
      id: `alloc-import-${importStamp}-${i}`,
      courseSectionId,
      day,
      slotId: slot.id,
      roomId: room.id,
      note: isReservedAllocation(courseSectionId) ? rawCourse : undefined,
      allocatedAt: new Date().toISOString(),
    });
  }

  const info: string[] = [];
  if (emptyCells > 0) info.push(`${emptyCells} empty cells ignored (free rooms)`);
  if (reservedCells > 0) info.push(`${reservedCells} reserved cells (e.g. prayer break) imported as room blocks`);
  const warningMessages = warnings.toMessages();
  if (newRooms.length > 0) {
    warningMessages.push(
      `${newRooms.length} room(s) not in the rooms list were created with unknown capacity – import a rooms CSV to set it (${newRooms.slice(0, 3).map(r => r.name).join(', ')})`
    );
  }

  return {
    items: allocations,
    newRooms,
    report: {
      imported: allocations.length,
      skipped: errors.total,
      errors: errors.toMessages(),
      warnings: warningMessages,
      info,
    },
  };
}

function normalizeRoomType(raw: string | undefined): RoomType | undefined {
  const value = (raw || '').toLowerCase();
  if (!value) return undefined;
  if (value.includes('lab')) return 'Lab';
  if (value.includes('smart')) return 'Smart Classroom';
  if (value.includes('seminar') || value.includes('hall')) return 'Seminar Hall';
  return 'Lecture';
}

/**
 * Parses Rooms CSV and merges it into the existing rooms (matched by ID or name),
 * so timetable entries keep pointing at the same room IDs.
 * Expected headers: Room Name, Type, Capacity, Building (Room ID optional)
 */
export function parseRoomsCSV(csvText: string, existingRooms: Room[]): ParseResult<Room> {
  const rows = parseCSVText(csvText);
  if (rows.length < 2) return { items: [], report: EMPTY_REPORT };
  const errors = new IssueCollector();
  const warnings = new IssueCollector();

  const headers = rows[0].map(normalizeHeader);
  const idIdx = headers.findIndex(h => h === 'roomid' || h === 'id');
  const nameIdx = headers.findIndex(h => h === 'roomname' || h === 'room' || h === 'name');
  const typeIdx = headers.findIndex(h => h.includes('type'));
  const capIdx = headers.findIndex(h => h.includes('capacity') || h.includes('seats'));
  const buildingIdx = headers.findIndex(h => h.includes('building') || h.includes('block'));

  const merged = existingRooms.map(r => ({ ...r }));
  const lookup = new Map<string, Room>();
  for (const room of merged) {
    lookup.set(room.id.toLowerCase(), room);
    lookup.set(room.name.toLowerCase(), room);
  }

  let updated = 0;
  let added = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const rawId = idIdx !== -1 ? row[idIdx]?.trim() || '' : '';
    const name = (nameIdx !== -1 ? row[nameIdx] : row[0])?.trim() || rawId;
    if (!name) {
      errors.add('Missing room name', `line ${line}`);
      continue;
    }

    const rawCapacity = capIdx !== -1 ? row[capIdx]?.trim() || '' : '';
    const capacity = Number(rawCapacity);
    const hasCapacity = rawCapacity !== '' && Number.isFinite(capacity) && capacity > 0;
    if (rawCapacity && !hasCapacity) {
      warnings.add('Invalid capacity (left unchanged)', `line ${line}: ${name} "${rawCapacity}"`);
    }
    const type = normalizeRoomType(typeIdx !== -1 ? row[typeIdx] : undefined);
    const building = buildingIdx !== -1 ? row[buildingIdx]?.trim() : '';

    const existing = (rawId && lookup.get(rawId.toLowerCase())) || lookup.get(name.toLowerCase());
    if (existing) {
      if (hasCapacity) existing.capacity = capacity;
      if (type) existing.type = type;
      if (building) existing.building = building;
      updated++;
    } else {
      let id = rawId || slugifyRoomId(name);
      while (lookup.has(id.toLowerCase())) id += '-x';
      const room: Room = {
        id,
        name,
        type: type || guessRoomType(name),
        capacity: hasCapacity ? capacity : 0,
        building: building || 'Unknown',
      };
      merged.push(room);
      lookup.set(id.toLowerCase(), room);
      lookup.set(name.toLowerCase(), room);
      added++;
    }
  }

  return {
    items: merged,
    report: {
      imported: updated + added,
      skipped: errors.total,
      errors: errors.toMessages(),
      warnings: warnings.toMessages(),
      info: [`${updated} existing rooms updated, ${added} new rooms added`],
    },
  };
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

export const SAMPLE_ROOMS_CSV = `Room Name,Type,Capacity,Building
C-301,Lecture,50,Academic Block C
D-301,Smart Classroom,45,Academic Block D
IT Lab 1 (D-210),Lab,40,Academic Block D
`;

export const SAMPLE_TIMETABLE_CSV = `Day,TimeSlot,Room,Course Section
Monday,Slot 2,Room A-1,AI4015 BCS-7B
Monday,Slot 4,CS-101,CS3001 BAI-5A
Tuesday,Slot 3,Room A-1,CS4001 BCS-7B
Wednesday,Slot 2,Room A-1,AI4015 BCS-7B
Wednesday,Slot 4,CS-102,SE3002 BSE-6A
`;
