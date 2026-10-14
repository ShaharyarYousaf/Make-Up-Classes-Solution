/**
 * Builds the dataset every visitor sees on first load from the CSVs in `Fall 2026/`,
 * using the same parsers as the in-app Data Manager.
 *
 *   npm run build:data
 *
 * Commit the regenerated files in data/ and push; Vercel redeploys with the new defaults.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  ImportReport,
  parseCoursesCSV,
  parseRoomsCSV,
  parseStudentsCSV,
  parseTimetableCSV,
} from '../src/lib/csvParser';

const SOURCE_DIR = join(__dirname, '..', 'Fall 2026');
const DATA_DIR = join(__dirname, '..', 'data');
const FILES = {
  courses: 'courses_list_Fall_2026.csv',
  rooms: 'rooms_Fall_2026.csv',
  // Optional Start Time / End Time columns hold exact times for classes that do not fit their slot
  timetable: 'timetable_with_custom_times.csv',
  students: 'students_enrollment_Fall_2026.csv',
};

/** UTF-8, or Windows-1252 when Excel saved the CSV in its legacy encoding */
function read(file: string): string {
  const bytes = readFileSync(join(SOURCE_DIR, file));
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

let failed = false;
function log(label: string, report: ImportReport) {
  console.log(`\n${label}: ${report.imported} imported, ${report.skipped} rejected`);
  report.errors.forEach((m) => console.log(`  ✖ ${m}`));
  report.warnings.forEach((m) => console.log(`  ⚠ ${m}`));
  report.info.forEach((m) => console.log(`  · ${m}`));
  if (report.imported === 0) failed = true;
}

async function main() {
  // Same order as the Data Manager: courses → rooms → timetable → students
  const courses = parseCoursesCSV(read(FILES.courses));
  log('Courses', courses.report);

  const rooms = parseRoomsCSV(read(FILES.rooms), []);
  log('Rooms', rooms.report);

  const timetable = parseTimetableCSV(read(FILES.timetable), rooms.items, courses.items);
  log('Timetable', timetable.report);

  const students = parseStudentsCSV(read(FILES.students), courses.items);
  log('Students', students.report);

  if (failed) {
    console.error('\nA dataset came out empty – data/ was not updated.');
    process.exit(1);
  }

  const allRooms = [...rooms.items, ...timetable.newRooms];
  // Changes whenever the data does, so browsers holding an older cached timetable reload the new one
  const version = Date.now();

  writeFileSync(
    join(DATA_DIR, 'real_timetable_data.json'),
    JSON.stringify({ version, rooms: allRooms, courses: courses.items, allocations: timetable.items })
  );
  writeFileSync(join(DATA_DIR, 'students_roster.json'), JSON.stringify(students.items));

  console.log(
    `\nWrote data/: ${allRooms.length} rooms, ${courses.items.length} courses, ` +
      `${timetable.items.length} allocations, ${students.items.length} students (version ${version}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
