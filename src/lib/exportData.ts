import { Allocation, CourseSection, Room, Student } from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from './constants';
import { getReservedLabel, isReservedAllocation } from './csvParser';
import { allocationInterval } from './timeline';
import { minutesToTimeString } from './utils';

/**
 * Current data as sheets in the same layout the importer reads, so an export can be edited and re-imported.
 */

export type Sheet = { name: string; file: string; rows: (string | number)[][] };

interface DataSet {
  rooms: Room[];
  courses: CourseSection[];
  students: Student[];
  allocations: Allocation[];
}

export function buildSheets({ rooms, courses, students, allocations }: DataSet): Sheet[] {
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const slotNumber = new Map(STANDARD_TIME_SLOTS.map((s) => [s.id, s.slotNumber]));
  const dayIndex = (d: string) => DAYS_OF_WEEK.indexOf(d as (typeof DAYS_OF_WEEK)[number]);

  const timetable = [...allocations]
    .map((a) => ({ a, i: allocationInterval(a) }))
    .sort(
      (x, y) =>
        dayIndex(x.a.day) - dayIndex(y.a.day) ||
        x.i.startMinutes - y.i.startMinutes ||
        (roomName.get(x.a.roomId) || '').localeCompare(roomName.get(y.a.roomId) || '', undefined, { numeric: true })
    )
    .map(({ a, i }) => [
      a.day,
      slotNumber.has(a.slotId) ? `Slot ${slotNumber.get(a.slotId)}` : '',
      roomName.get(a.roomId) || a.roomId,
      isReservedAllocation(a.courseSectionId) ? getReservedLabel(a.courseSectionId) : a.courseSectionId,
      // Only classes that do not match their slot carry an exact time (same rule as the importer)
      a.customInterval ? minutesToTimeString(i.startMinutes) : '',
      a.customInterval ? minutesToTimeString(i.endMinutes) : '',
      a.isRescheduled ? 'Rescheduled' : '',
      a.note || '',
    ]);

  return [
    {
      name: 'Timetable',
      file: 'timetable_with_custom_times.csv',
      rows: [['Day', 'TimeSlot', 'Room', 'Course Section', 'Start Time', 'End Time', 'Status', 'Note'], ...timetable],
    },
    {
      name: 'Courses',
      file: 'courses_list.csv',
      rows: [
        ['Course', 'Course Title', 'Section', 'Department', 'Instructor', 'Credit Hours'],
        ...courses.map((c) => [c.courseCode, c.courseTitle, c.section, c.department, c.instructor, c.creditHours]),
      ],
    },
    {
      name: 'Students',
      file: 'students_enrollment.csv',
      rows: [
        ['Student ID', 'Student Name', 'Course Section Code'],
        ...students.flatMap((s) => s.enrolledSectionIds.map((id) => [s.id, s.name, id])),
      ],
    },
    {
      name: 'Rooms',
      file: 'rooms.csv',
      rows: [
        ['Room Name', 'Type', 'Capacity', 'Building'],
        ...[...rooms]
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((r) => [r.name, r.type, r.capacity || '', r.building]),
      ],
    },
  ];
}

const csvCell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(rows: (string | number)[][]): string {
  // BOM so Excel opens the UTF-8 file with the right characters (the importer strips it)
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(sheet: Sheet, stamp: string) {
  downloadBlob(new Blob([toCSV(sheet.rows)], { type: 'text/csv;charset=utf-8' }), sheet.file.replace('.csv', `_${stamp}.csv`));
}

/** One Excel workbook with a sheet per dataset (the Excel library loads only when needed). */
export async function downloadWorkbook(sheets: Sheet[], filename: string) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Make-Up Class Scheduler';
  workbook.created = new Date();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRows(sheet.rows);
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.rows[0].length } };
    ws.columns.forEach((col, i) => {
      const longest = sheet.rows.slice(0, 500).reduce((m, r) => Math.max(m, String(r[i] ?? '').length), 8);
      col.width = Math.min(longest + 2, 60);
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
