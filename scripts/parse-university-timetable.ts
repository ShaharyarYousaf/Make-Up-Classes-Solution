import fs from 'fs';
import path from 'path';

interface ParsedAllocation {
  id: string;
  courseSectionId: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  department: string;
  day: string;
  slotId: string;
  startTime: string;
  endTime: string;
  roomId: string;
  roomName: string;
  rawText: string;
  customTime?: boolean;
}

interface ParsedRoom {
  id: string;
  name: string;
  type: 'Lecture' | 'Lab' | 'Smart Classroom' | 'Seminar Hall';
  capacity: number;
  building: string;
}

interface ParsedCourse {
  id: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  department: string;
  creditHours: number;
  instructor: string;
}

function isStartOfNewRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '.') return false;
  if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(trimmed)) return true;
  if (trimmed.startsWith('Room/ Time') || trimmed.startsWith('Lab')) return true;

  // Room prefixes
  if (/^(C-\d+|D-\d+|C-110)/i.test(trimmed)) return true;
  if (/^(IT Lab|Margala|Rawal|C-Rawal|Cyber|CALL|Mehran|B-Computing|B-Digital|Kybher)/i.test(trimmed)) return true;

  return false;
}

function parseCourseCell(cell: string): {
  code: string;
  title: string;
  section: string;
  customTimeStr?: string;
}[] {
  const clean = cell.replace(/^"/, '').replace(/"$/, '').trim();
  if (!clean || clean.toLowerCase() === 'fsm' || clean.toLowerCase() === 'ee') {
    return [];
  }

  // Friday prayer break
  if (clean.includes('P  R  A  Y  E  R') || clean.includes('P R A Y E R')) {
    return [{ code: 'BREAK', title: 'Friday Prayer & Lunch Break', section: 'ALL' }];
  }

  // FYP evaluations
  if (clean.includes('FYP/Thesis') || clean.includes('FYP')) {
    return [{ code: 'FYP', title: 'Final Year Project / Thesis Evaluations', section: 'ALL' }];
  }

  // Split multiple lines if present
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: { code: string; title: string; section: string; customTimeStr?: string }[] = [];

  for (const line of lines) {
    if (!line) continue;

    // Check for custom time e.g. "01:00-02:45", "11:30-12:25", "03:00-06:00"
    const timeMatch = line.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
    const customTimeStr = timeMatch ? timeMatch[1].replace(/\s+/g, '') : undefined;
    const textWithoutTime = timeMatch ? line.replace(timeMatch[0], '').trim() : line;

    // Match Course Code: e.g. "CS-1002", "CS1002", "MT1003", "AI4015", "CL1000", "EL2003", "SL1012"
    const codeMatch = textWithoutTime.match(/^([A-Za-z]{2,4}-?\d{4})/);
    if (codeMatch) {
      const code = codeMatch[1];
      const remainder = textWithoutTime.slice(codeMatch[0].length).trim();

      // Look for section at end: e.g. "(CS-A)", "BCS-1A", "BAI-7A", "PCS-1A", "BSE-3A", "MCY-1A", "(SE-B)"
      const secMatch = remainder.match(/(\(?[A-Za-z0-9]+-[A-Za-z0-9]+\)?)$/);
      let section = 'A';
      let title = remainder;

      if (secMatch) {
        section = secMatch[1].replace(/[()]/g, '');
        title = remainder.slice(0, remainder.length - secMatch[0].length).trim();
      }

      results.push({
        code,
        title: title || code,
        section,
        customTimeStr,
      });
    } else {
      const secMatch = textWithoutTime.match(/(\(?[A-Za-z0-9]+-[A-Za-z0-9]+\)?)$/);
      const section = secMatch ? secMatch[1].replace(/[()]/g, '') : 'A';
      const title = secMatch ? textWithoutTime.slice(0, textWithoutTime.length - secMatch[0].length).trim() : textWithoutTime;

      results.push({
        code: title.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, ''),
        title,
        section,
        customTimeStr,
      });
    }
  }

  return results;
}

function inferDepartment(code: string, section: string): string {
  const c = code.toUpperCase();
  const s = section.toUpperCase();

  if (s.includes('BAI') || s.includes('MAI') || c.startsWith('AI') || c.startsWith('AL')) {
    return 'Artificial Intelligence';
  }
  if (s.includes('BSE') || s.includes('MSE') || s.includes('PSE') || c.startsWith('SE') || c.startsWith('SL')) {
    return 'Software Engineering';
  }
  if (s.includes('BCY') || s.includes('MCY') || c.startsWith('CY') || c.startsWith('YL')) {
    return 'Cyber Security';
  }
  if (s.includes('BDS') || s.includes('MDS') || c.startsWith('DS') || c.startsWith('DL')) {
    return 'Data Science';
  }
  if (c.startsWith('MT') || c.startsWith('NS') || c.startsWith('SS') || c.startsWith('MG')) {
    return 'Sciences & Humanities';
  }
  if (c.startsWith('EE') || c.startsWith('EL')) {
    return 'Electrical Engineering';
  }
  return 'Computer Science';
}

function roomIdFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function inferRoomType(name: string): 'Lecture' | 'Lab' | 'Smart Classroom' | 'Seminar Hall' {
  const n = name.toLowerCase();
  if (n.includes('lab') || n.includes('margala') || n.includes('rawal') || n.includes('cyber') || n.includes('call') || n.includes('mehran') || n.includes('digital') || n.includes('computing')) {
    return 'Lab';
  }
  if (n.includes('seminar') || n.includes('audi')) {
    return 'Seminar Hall';
  }
  if (name.startsWith('D-') || name.startsWith('d-')) {
    return 'Smart Classroom';
  }
  return 'Lecture';
}

function inferBuilding(name: string): string {
  if (name.startsWith('C-') || name.startsWith('C ')) return 'Academic Block C';
  if (name.startsWith('D-') || name.startsWith('D ')) return 'Academic Block D';
  if (name.startsWith('A-') || name.startsWith('A ')) return 'Academic Block A';
  return 'Computing & Tech Complex';
}

// 1. Read and merge multi-line rows
const rawText = fs.readFileSync(path.join(process.cwd(), 'data', 'raw_timetable.txt'), 'utf-8');
const lines = rawText.split(/\r?\n/);

const mergedRows: string[] = [];
let currentRow = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim() && !currentRow) continue;

  if (isStartOfNewRow(line)) {
    if (currentRow) mergedRows.push(currentRow);
    currentRow = line;
  } else if (currentRow) {
    currentRow += '\n' + line;
  } else {
    if (line.trim()) mergedRows.push(line);
  }
}
if (currentRow) mergedRows.push(currentRow);

console.log(`Merged physical rows into ${mergedRows.length} logical rows.`);

interface ColumnHeaderMap {
  type: 'lecture' | 'lab';
  slotBounds: { slotId: string; startIdx: number; endIdx: number; startTime: string; endTime: string }[];
  room2ColIdx?: number;
  eveningBounds?: { slotId: string; startIdx: number; endIdx: number; startTime: string; endTime: string }[];
}

let activeDay = 'Monday';
let currentHeaderMap: ColumnHeaderMap = { type: 'lecture', slotBounds: [] };

const allAllocations: ParsedAllocation[] = [];
const roomMap = new Map<string, ParsedRoom>();
const courseMap = new Map<string, ParsedCourse>();

for (const row of mergedRows) {
  const cols = row.split('\t');
  const firstCell = cols[0]?.trim();

  // Day switch
  if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(firstCell)) {
    activeDay = firstCell;
    continue;
  }

  // Header detection
  if (firstCell.startsWith('Room/ Time')) {
    // Determine column indices for slots
    const headerPositions: { text: string; idx: number }[] = [];
    cols.forEach((c, idx) => {
      const clean = c.trim();
      if (clean) headerPositions.push({ text: clean, idx });
    });

    const slotBounds: { slotId: string; startIdx: number; endIdx: number; startTime: string; endTime: string }[] = [];
    let room2ColIdx: number | undefined = undefined;
    const eveningBounds: { slotId: string; startIdx: number; endIdx: number; startTime: string; endTime: string }[] = [];

    for (let h = 0; h < headerPositions.length; h++) {
      const { text, idx } = headerPositions[h];
      const nextIdx = headerPositions[h + 1] ? headerPositions[h + 1].idx : cols.length;

      if (text.includes('08:30')) {
        slotBounds.push({ slotId: 'slot-1', startIdx: idx, endIdx: nextIdx, startTime: '08:30', endTime: '09:50' });
      } else if (text.includes('10:00')) {
        slotBounds.push({ slotId: 'slot-2', startIdx: idx, endIdx: nextIdx, startTime: '10:00', endTime: '11:20' });
      } else if (text.includes('11:30')) {
        slotBounds.push({ slotId: 'slot-3', startIdx: idx, endIdx: nextIdx, startTime: '11:30', endTime: '12:50' });
      } else if (text.includes('01:00')) {
        slotBounds.push({ slotId: 'slot-4', startIdx: idx, endIdx: nextIdx, startTime: '13:00', endTime: '14:20' });
      } else if (text.includes('02:30')) {
        slotBounds.push({ slotId: 'slot-5', startIdx: idx, endIdx: nextIdx, startTime: '14:30', endTime: '15:50' });
      } else if (text.includes('03:55')) {
        slotBounds.push({ slotId: 'slot-6', startIdx: idx, endIdx: nextIdx, startTime: '15:55', endTime: '17:15' });
      } else if (text === 'Room') {
        room2ColIdx = idx;
      } else if (text.includes('05:20')) {
        eveningBounds.push({ slotId: 'slot-7', startIdx: idx, endIdx: nextIdx, startTime: '17:20', endTime: '18:40' });
      } else if (text.includes('06:45')) {
        eveningBounds.push({ slotId: 'slot-8', startIdx: idx, endIdx: nextIdx, startTime: '18:45', endTime: '20:05' });
      }
    }

    currentHeaderMap = {
      type: 'lecture',
      slotBounds,
      room2ColIdx,
      eveningBounds,
    };
    continue;
  }

  if (firstCell.startsWith('Lab')) {
    const headerPositions: { text: string; idx: number }[] = [];
    cols.forEach((c, idx) => {
      const clean = c.trim();
      if (clean) headerPositions.push({ text: clean, idx });
    });

    const slotBounds: { slotId: string; startIdx: number; endIdx: number; startTime: string; endTime: string }[] = [];

    for (let h = 0; h < headerPositions.length; h++) {
      const { text, idx } = headerPositions[h];
      const nextIdx = headerPositions[h + 1] ? headerPositions[h + 1].idx : cols.length;

      if (text.includes('08:30')) {
        slotBounds.push({ slotId: 'lab-1', startIdx: idx, endIdx: nextIdx, startTime: '08:30', endTime: '11:15' });
      } else if (text.includes('11:30')) {
        slotBounds.push({ slotId: 'lab-2', startIdx: idx, endIdx: nextIdx, startTime: '11:30', endTime: '14:15' });
      } else if (text.includes('02:30')) {
        slotBounds.push({ slotId: 'lab-3', startIdx: idx, endIdx: nextIdx, startTime: '14:30', endTime: '17:15' });
      } else if (text.includes('05:20')) {
        slotBounds.push({ slotId: 'lab-4', startIdx: idx, endIdx: nextIdx, startTime: '17:20', endTime: '20:05' });
      }
    }

    currentHeaderMap = {
      type: 'lab',
      slotBounds,
    };
    continue;
  }

  // Data row processing!
  if (currentHeaderMap.type === 'lecture') {
    const leftRoomName = firstCell;
    const leftRoomId = roomIdFromName(leftRoomName);

    if (!roomMap.has(leftRoomId)) {
      roomMap.set(leftRoomId, {
        id: leftRoomId,
        name: leftRoomName,
        type: inferRoomType(leftRoomName),
        capacity: 50,
        building: inferBuilding(leftRoomName),
      });
    }

    // Process Left Room Standard Slots
    for (const sb of currentHeaderMap.slotBounds) {
      let cellText = '';
      for (let c = sb.startIdx; c < sb.endIdx && c < cols.length; c++) {
        if (cols[c]?.trim()) {
          cellText = cols[c].trim();
          break;
        }
      }
      if (!cellText) continue;

      const parsedCourses = parseCourseCell(cellText);
      for (const pc of parsedCourses) {
        const courseId = `${pc.code} ${pc.section}`;
        const dept = inferDepartment(pc.code, pc.section);

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            id: courseId,
            courseCode: pc.code,
            courseTitle: pc.title,
            section: pc.section,
            department: dept,
            creditHours: 3,
            instructor: 'FAST Faculty',
          });
        }

        allAllocations.push({
          id: `alloc-${activeDay.slice(0, 3).toLowerCase()}-${leftRoomId}-${sb.slotId}-${allAllocations.length}`,
          courseSectionId: courseId,
          courseCode: pc.code,
          courseTitle: pc.title,
          section: pc.section,
          department: dept,
          day: activeDay,
          slotId: sb.slotId,
          startTime: pc.customTimeStr ? pc.customTimeStr.split('-')[0] : sb.startTime,
          endTime: pc.customTimeStr ? pc.customTimeStr.split('-')[1] : sb.endTime,
          roomId: leftRoomId,
          roomName: leftRoomName,
          rawText: cellText,
          customTime: !!pc.customTimeStr,
        });
      }
    }

    // Process Right Room Evening Slots if present
    if (currentHeaderMap.room2ColIdx && currentHeaderMap.eveningBounds) {
      const rightRoomName = cols[currentHeaderMap.room2ColIdx]?.trim();
      if (rightRoomName && rightRoomName !== 'Room' && rightRoomName.length > 1) {
        const rightRoomId = roomIdFromName(rightRoomName);

        if (!roomMap.has(rightRoomId)) {
          roomMap.set(rightRoomId, {
            id: rightRoomId,
            name: rightRoomName,
            type: inferRoomType(rightRoomName),
            capacity: 45,
            building: inferBuilding(rightRoomName),
          });
        }

        for (const eb of currentHeaderMap.eveningBounds) {
          let cellText = '';
          for (let c = eb.startIdx; c < eb.endIdx && c < cols.length; c++) {
            if (cols[c]?.trim()) {
              cellText = cols[c].trim();
              break;
            }
          }
          if (!cellText) continue;

          const parsedCourses = parseCourseCell(cellText);
          for (const pc of parsedCourses) {
            const courseId = `${pc.code} ${pc.section}`;
            const dept = inferDepartment(pc.code, pc.section);

            if (!courseMap.has(courseId)) {
              courseMap.set(courseId, {
                id: courseId,
                courseCode: pc.code,
                courseTitle: pc.title,
                section: pc.section,
                department: dept,
                creditHours: 3,
                instructor: 'FAST Faculty',
              });
            }

            allAllocations.push({
              id: `alloc-${activeDay.slice(0, 3).toLowerCase()}-${rightRoomId}-${eb.slotId}-${allAllocations.length}`,
              courseSectionId: courseId,
              courseCode: pc.code,
              courseTitle: pc.title,
              section: pc.section,
              department: dept,
              day: activeDay,
              slotId: eb.slotId,
              startTime: pc.customTimeStr ? pc.customTimeStr.split('-')[0] : eb.startTime,
              endTime: pc.customTimeStr ? pc.customTimeStr.split('-')[1] : eb.endTime,
              roomId: rightRoomId,
              roomName: rightRoomName,
              rawText: cellText,
              customTime: !!pc.customTimeStr,
            });
          }
        }
      }
    }
  } else {
    // Lab Row Processing
    const labRoomName = firstCell;
    const labRoomId = roomIdFromName(labRoomName);

    if (!roomMap.has(labRoomId)) {
      roomMap.set(labRoomId, {
        id: labRoomId,
        name: labRoomName,
        type: 'Lab',
        capacity: 40,
        building: inferBuilding(labRoomName),
      });
    }

    for (const lb of currentHeaderMap.slotBounds) {
      let cellText = '';
      for (let c = lb.startIdx; c < lb.endIdx && c < cols.length; c++) {
        if (cols[c]?.trim()) {
          cellText = cols[c].trim();
          break;
        }
      }
      if (!cellText) continue;

      const parsedCourses = parseCourseCell(cellText);
      for (const pc of parsedCourses) {
        const courseId = `${pc.code} ${pc.section}`;
        const dept = inferDepartment(pc.code, pc.section);

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            id: courseId,
            courseCode: pc.code,
            courseTitle: pc.title,
            section: pc.section,
            department: dept,
            creditHours: 1,
            instructor: 'Lab Instructor',
          });
        }

        allAllocations.push({
          id: `alloc-${activeDay.slice(0, 3).toLowerCase()}-${labRoomId}-${lb.slotId}-${allAllocations.length}`,
          courseSectionId: courseId,
          courseCode: pc.code,
          courseTitle: pc.title,
          section: pc.section,
          department: dept,
          day: activeDay,
          slotId: lb.slotId,
          startTime: pc.customTimeStr ? pc.customTimeStr.split('-')[0] : lb.startTime,
          endTime: pc.customTimeStr ? pc.customTimeStr.split('-')[1] : lb.endTime,
          roomId: labRoomId,
          roomName: labRoomName,
          rawText: cellText,
          customTime: !!pc.customTimeStr,
        });
      }
    }
  }
}

console.log('=============================================');
console.log('✨ ADVANCED TIMETABLE PARSING SUCCESSFUL ✨');
console.log('=============================================');
console.log(`Total Campus Rooms: ${roomMap.size}`);
console.log(`Total Courses & Sections: ${courseMap.size}`);
console.log(`Total Active Class Allocations: ${allAllocations.length}`);

// Output Day Allocation Breakdown
const dayBreakdown: Record<string, number> = {};
for (const a of allAllocations) {
  dayBreakdown[a.day] = (dayBreakdown[a.day] || 0) + 1;
}
console.log('Allocations per Day:', dayBreakdown);

// Write CSV: data/timetable_schedule.csv
let timetableCSV = 'Day,TimeSlot,StartTime,EndTime,Room ID,Room Name,Course Section Code,Course Code,Course Title,Section,Department\n';
for (const a of allAllocations) {
  timetableCSV += `"${a.day}","${a.slotId}","${a.startTime}","${a.endTime}","${a.roomId}","${a.roomName}","${a.courseSectionId}","${a.courseCode}","${a.courseTitle.replace(/"/g, '""')}","${a.section}","${a.department}"\n`;
}
fs.writeFileSync(path.join(process.cwd(), 'data', 'timetable_schedule.csv'), timetableCSV, 'utf-8');

// Write CSV: data/courses_catalog.csv
let coursesCSV = 'Course Section ID,Course Code,Course Title,Section,Department,Credit Hours,Instructor\n';
for (const c of Array.from(courseMap.values())) {
  coursesCSV += `"${c.id}","${c.courseCode}","${c.courseTitle.replace(/"/g, '""')}","${c.section}","${c.department}",${c.creditHours},"${c.instructor}"\n`;
}
fs.writeFileSync(path.join(process.cwd(), 'data', 'courses_catalog.csv'), coursesCSV, 'utf-8');

// Write CSV: data/rooms_directory.csv
let roomsCSV = 'Room ID,Room Name,Type,Capacity,Building\n';
for (const r of Array.from(roomMap.values())) {
  roomsCSV += `"${r.id}","${r.name}","${r.type}",${r.capacity},"${r.building}"\n`;
}
fs.writeFileSync(path.join(process.cwd(), 'data', 'rooms_directory.csv'), roomsCSV, 'utf-8');

// 4. Generate JSON dataset
const colorThemes = [
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200', badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200', accent: 'emerald' },
  { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-900 dark:text-blue-200', badge: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200', accent: 'blue' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-900 dark:text-indigo-200', badge: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200', accent: 'indigo' },
  { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200', accent: 'purple' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200', accent: 'amber' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-900 dark:text-cyan-200', badge: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200', accent: 'cyan' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-900 dark:text-rose-200', badge: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200', accent: 'rose' },
  { bg: 'bg-teal-50 dark:bg-teal-950/40', border: 'border-teal-300 dark:border-teal-700', text: 'text-teal-900 dark:text-teal-200', badge: 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200', accent: 'teal' },
];

const fullJson = {
  rooms: Array.from(roomMap.values()),
  courses: Array.from(courseMap.values()).map((c, i) => ({
    ...c,
    color: colorThemes[i % colorThemes.length],
  })),
  allocations: allAllocations.map(a => ({
    id: a.id,
    courseSectionId: a.courseSectionId,
    day: a.day,
    slotId: a.slotId,
    customInterval: a.customTime
      ? {
          startTime: a.startTime,
          endTime: a.endTime,
          startMinutes: parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]),
          endMinutes: parseInt(a.endTime.split(':')[0]) * 60 + parseInt(a.endTime.split(':')[1]),
        }
      : undefined,
    roomId: a.roomId,
    allocatedAt: '2026-09-01T08:00:00Z',
  })),
};

fs.writeFileSync(path.join(process.cwd(), 'data', 'real_timetable_data.json'), JSON.stringify(fullJson, null, 2), 'utf-8');

// 5. Generate concise TypeScript loader: src/lib/realTimetableData.ts
const tsContent = `// Automatically loaded from parsed university timetable JSON dataset
import { Allocation, CourseSection, Room } from '../types/timetable';
import realData from '../../data/real_timetable_data.json';

export const REAL_ROOMS: Room[] = realData.rooms as Room[];
export const REAL_COURSES: CourseSection[] = realData.courses as CourseSection[];
export const REAL_ALLOCATIONS: Allocation[] = realData.allocations as unknown as Allocation[];
`;

fs.writeFileSync(path.join(process.cwd(), 'src', 'lib', 'realTimetableData.ts'), tsContent, 'utf-8');

console.log('✅ Generated data/timetable_schedule.csv');
console.log('✅ Generated data/courses_catalog.csv');
console.log('✅ Generated data/rooms_directory.csv');
console.log('✅ Generated data/real_timetable_data.json');
console.log('✅ Generated src/lib/realTimetableData.ts');
