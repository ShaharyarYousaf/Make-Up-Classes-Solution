import fs from 'fs';
import path from 'path';
import realData from '../data/real_timetable_data.json';

const realCourses = realData.courses as { id: string; section: string; department: string }[];

const baseStudents = [
  { id: '21I-0412', name: 'Syed Umar Javed', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4001 BCS-7B', 'CS4075 BCS-7A', 'CS3001 BAI-5A'] },
  { id: '20I-0830', name: 'Salar Shoaib Abbasi', batch: '2020', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS3001 BAI-5A', 'SE3002 BSE-5A'] },
  { id: '21I-1149', name: 'Hamza Tariq', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4001 BCS-7B', 'CS4075 BCS-7A'] },
  { id: '21I-0592', name: 'Fatima Noor', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4001 BCS-7B', 'SE3002 BSE-5A'] },
  { id: '20I-0671', name: 'Bilal Ahmed Khan', batch: '2020', dept: 'Artificial Intelligence', sections: ['AI4015 BCS-7B', 'AI4015 BAI-7A', 'CS3001 BAI-5A'] },
  { id: '21I-0331', name: 'Ayesha Siddiqua', batch: '2021', dept: 'Artificial Intelligence', sections: ['AI4015 BAI-7A', 'CS3001 BAI-5A'] },
  { id: '22I-1082', name: 'Daniyal Malik', batch: '2022', dept: 'Computer Science', sections: ['CS2001 BCS-3A', 'MT1004 BCS-3A', 'EE1005 BCS-3A'] },
  { id: '22I-0914', name: 'Zainab Rauf', batch: '2022', dept: 'Computer Science', sections: ['CS2001 BCS-3A', 'MT1004 BCS-3A', 'CS3004 BCS-3A'] },
  { id: '21I-1203', name: 'Abdullah Shah', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4001 BCS-7B'] },
  { id: '21I-0455', name: 'Mahnoor Akhtar', batch: '2021', dept: 'Software Engineering', sections: ['SE3002 BSE-5A', 'CS3001 BAI-5A'] },
  { id: '21I-0782', name: 'Muhammad Haris', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4075 BCS-7A'] },
  { id: '21I-0899', name: 'Eman Fatima', batch: '2021', dept: 'Artificial Intelligence', sections: ['AI4015 BAI-7A', 'CS3001 BAI-5A', 'AI4015 BCS-7B'] },
  { id: '20I-1432', name: 'Hassan Raza', batch: '2020', dept: 'Software Engineering', sections: ['SE3002 BSE-5A', 'CS3001 BAI-5A'] },
  { id: '21I-0128', name: 'Maryam Naveed', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4001 BCS-7B'] },
  { id: '21I-0664', name: 'Waleed Bin Khalid', batch: '2021', dept: 'Computer Science', sections: ['AI4015 BCS-7B', 'CS4001 BCS-7B'] },
  { id: '21I-0941', name: 'Sarah Jane Khan', batch: '2021', dept: 'Artificial Intelligence', sections: ['AI4015 BAI-7A', 'CS3001 BAI-5A'] },
  { id: '22I-0419', name: 'Mustafa Kamal', batch: '2022', dept: 'Computer Science', sections: ['CS2001 BCS-3A', 'MT1004 BCS-3A'] },
  { id: '22I-0555', name: 'Khadija Bano', batch: '2022', dept: 'Computer Science', sections: ['CS2001 BCS-3A', 'MT1004 BCS-3A'] },
  { id: '22I-0731', name: 'Shahmeer Ali', batch: '2022', dept: 'Computer Science', sections: ['CS2001 BCS-3A', 'MT1004 BCS-3A'] },
  { id: '22I-0812', name: 'Nimra Qureshi', batch: '2022', dept: 'Computer Science', sections: ['CS-1002 CS-A', 'MT1003 BCS-1A'] },
];

// Group courses by section
const sectionToCourses = new Map<string, string[]>();
for (const c of realCourses) {
  if (!sectionToCourses.has(c.section)) {
    sectionToCourses.set(c.section, []);
  }
  sectionToCourses.get(c.section)!.push(c.id);
}

const firstNames = ['Muhammad', 'Ahmed', 'Ali', 'Usman', 'Hamza', 'Bilal', 'Zain', 'Talha', 'Omar', 'Saad', 'Fatima', 'Ayesha', 'Zainab', 'Maryam', 'Noor', 'Sara', 'Khadija', 'Hira', 'Sana', 'Iqra'];
const lastNames = ['Khan', 'Ahmed', 'Ali', 'Malik', 'Raza', 'Shah', 'Tariq', 'Siddiqui', 'Iqbal', 'Hassan', 'Sheikh', 'Farooq', 'Qureshi', 'Bhatti', 'Mirza', 'Javed', 'Abbasi', 'Naveed', 'Akhtar', 'Chaudhry'];

const allStudents = [...baseStudents.map(s => ({
  id: s.id,
  name: s.name,
  degreeProgram: `BS ${s.dept}`,
  batch: s.batch,
  enrolledSectionIds: s.sections,
}))];

let rollNumCounter = 100;

// For each major section in the university, ensure 5-8 students are registered
for (const [section, courseIds] of Array.from(sectionToCourses.entries())) {
  if (courseIds.length === 0) continue;

  const count = 6;
  const batchYear = section.includes('-1') ? '2025' : section.includes('-3') ? '2024' : section.includes('-5') ? '2023' : '2022';
  const prefix = batchYear.slice(2) + 'I-';

  for (let k = 0; k < count; k++) {
    const rollNo = `${prefix}${String(rollNumCounter++).padStart(4, '0')}`;
    const fn = firstNames[(rollNumCounter * 7) % firstNames.length];
    const ln = lastNames[(rollNumCounter * 13) % lastNames.length];

    allStudents.push({
      id: rollNo,
      name: `${fn} ${ln}`,
      degreeProgram: section.startsWith('BCS') ? 'BS Computer Science' : section.startsWith('BAI') ? 'BS Artificial Intelligence' : section.startsWith('BSE') ? 'BS Software Engineering' : section.startsWith('BDS') ? 'BS Data Science' : section.startsWith('BCY') ? 'BS Cyber Security' : 'Computer Science',
      batch: batchYear,
      enrolledSectionIds: courseIds.slice(0, 5),
    });
  }
}

// 1. Write CSV: data/students_roster.csv
let csv = 'Student ID,Student Name,Degree Program,Batch,Course Section Code\n';
for (const s of allStudents) {
  for (const cid of s.enrolledSectionIds) {
    csv += `"${s.id}","${s.name}","${s.degreeProgram}","${s.batch}","${cid}"\n`;
  }
}
fs.writeFileSync(path.join(process.cwd(), 'data', 'students_roster.csv'), csv, 'utf-8');

// 2. Write JSON: data/students_roster.json
fs.writeFileSync(path.join(process.cwd(), 'data', 'students_roster.json'), JSON.stringify(allStudents, null, 2), 'utf-8');

console.log(`✅ Generated data/students_roster.csv with ${allStudents.length} students.`);
console.log(`✅ Generated data/students_roster.json.`);
