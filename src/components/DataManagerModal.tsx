import React, { useState } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import {
  X,
  Download,
  Upload,
  RefreshCw,
  Database,
  Check,
  FileCode,
  Users,
  Building,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  parseCoursesCSV,
  parseStudentsCSV,
  parseTimetableCSV,
  SAMPLE_COURSES_CSV,
  SAMPLE_STUDENTS_CSV,
  SAMPLE_TIMETABLE_CSV,
} from '../lib/csvParser';

export const DataManagerModal: React.FC = () => {
  const {
    isDataManagerOpen,
    closeDataManager,
    rooms,
    courses,
    students,
    allocations,
    importDatasets,
    resetToDefaultData,
    showToast,
  } = useTimetableStore();

  const [activeTab, setActiveTab] = useState<'csv' | 'json' | 'export' | 'roster'>('csv');
  const [pastedCSV, setPastedCSV] = useState('');
  const [csvDataType, setCsvDataType] = useState<'students' | 'courses' | 'timetable'>('students');
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  if (!isDataManagerOpen) return null;

  const currentDataset = {
    metadata: {
      generatedAt: new Date().toISOString(),
      institution: 'FAST-NUCES Department of Computer Science & AI',
      semester: 'Fall 2026',
    },
    rooms,
    courses,
    students,
    allocations,
  };

  const formattedJson = JSON.stringify(currentDataset, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    showToast('Dataset copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([formattedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unischedule_dataset_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported complete dataset as JSON', 'info');
  };

  const handleDownloadCSVTemplate = (type: 'students' | 'courses' | 'timetable') => {
    let content = '';
    let filename = '';
    if (type === 'students') {
      content = SAMPLE_STUDENTS_CSV;
      filename = 'students_enrollment_template.csv';
    } else if (type === 'courses') {
      content = SAMPLE_COURSES_CSV;
      filename = 'courses_list_template.csv';
    } else {
      content = SAMPLE_TIMETABLE_CSV;
      filename = 'timetable_schedule_template.csv';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          importDatasets(parsed);
          setImportStatus({ msg: `Successfully imported JSON file: ${file.name}`, type: 'success' });
        } catch (err: any) {
          setImportStatus({ msg: `JSON File Error: ${err.message}`, type: 'error' });
        }
      } else {
        // Treat as CSV
        setPastedCSV(text);
        processCSV(text, csvDataType);
      }
    };
    reader.readAsText(file);
  };

  const processCSV = (text: string, type: 'students' | 'courses' | 'timetable') => {
    setImportStatus(null);
    try {
      if (type === 'students') {
        const parsedStudents = parseStudentsCSV(text);
        if (parsedStudents.length === 0) {
          throw new Error('No valid student rows found in CSV. Check headers.');
        }
        importDatasets({ students: parsedStudents });
        setImportStatus({
          msg: `Successfully imported ${parsedStudents.length} student records!`,
          type: 'success',
        });
      } else if (type === 'courses') {
        const parsedCourses = parseCoursesCSV(text);
        if (parsedCourses.length === 0) {
          throw new Error('No valid course rows found in CSV. Check headers.');
        }
        importDatasets({ courses: parsedCourses });
        setImportStatus({
          msg: `Successfully imported ${parsedCourses.length} course sections!`,
          type: 'success',
        });
      } else {
        const parsedAllocations = parseTimetableCSV(text, rooms);
        if (parsedAllocations.length === 0) {
          throw new Error('No valid timetable rows found in CSV. Check headers.');
        }
        importDatasets({ allocations: parsedAllocations });
        setImportStatus({
          msg: `Successfully imported ${parsedAllocations.length} timetable slot allocations!`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setImportStatus({ msg: `CSV Parse Error: ${err.message}`, type: 'error' });
    }
  };

  const handleJsonImport = () => {
    setImportStatus(null);
    try {
      const parsed = JSON.parse(jsonInput);
      importDatasets(parsed);
      setJsonInput('');
      setImportStatus({ msg: 'Full JSON dataset imported successfully!', type: 'success' });
    } catch (err: any) {
      setImportStatus({ msg: `JSON Syntax Error: ${err.message}`, type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Data Management & Real Dataset Ingestion
              </h3>
              <p className="text-xs text-gray-500">
                Upload CSV / Excel exports or JSON datasets for courses, students, and rooms
              </p>
            </div>
          </div>
          <button
            onClick={closeDataManager}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dataset Stats Bar */}
        <div className="p-3.5 bg-gray-50/50 dark:bg-zinc-800/40 border-b border-gray-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Courses</span>
            <div className="text-sm font-extrabold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              {courses.length}
            </div>
          </div>

          <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Students</span>
            <div className="text-sm font-extrabold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              {students.length}
            </div>
          </div>

          <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Rooms</span>
            <div className="text-sm font-extrabold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1">
              <Building className="w-3.5 h-3.5 text-purple-500" />
              {rooms.length}
            </div>
          </div>

          <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Allocations</span>
            <div className="text-sm font-extrabold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1">
              <Database className="w-3.5 h-3.5 text-amber-500" />
              {allocations.length}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-gray-200 dark:border-zinc-800 flex items-center gap-4">
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'csv'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Upload CSV / Excel
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Import JSON
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'roster'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Active Roster ({students.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5">
          {importStatus && (
            <div
              className={`p-3 mb-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                importStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
              }`}
            >
              <span>{importStatus.msg}</span>
              <button onClick={() => setImportStatus(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'csv' ? (
            <div className="space-y-4">
              {/* Template Download strip */}
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200 block">
                    Need standard CSV templates for your Excel sheets?
                  </span>
                  <span className="text-[11px] text-blue-700 dark:text-blue-400">
                    Download pre-formatted CSV headers to fill in your real office data.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleDownloadCSVTemplate('students')}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 rounded-md text-[11px] font-bold border border-blue-300 dark:border-blue-800 hover:bg-blue-50"
                  >
                    Students Template
                  </button>
                  <button
                    onClick={() => handleDownloadCSVTemplate('courses')}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 rounded-md text-[11px] font-bold border border-blue-300 dark:border-blue-800 hover:bg-blue-50"
                  >
                    Courses Template
                  </button>
                  <button
                    onClick={() => handleDownloadCSVTemplate('timetable')}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 rounded-md text-[11px] font-bold border border-blue-300 dark:border-blue-800 hover:bg-blue-50"
                  >
                    Timetable Template
                  </button>
                </div>
              </div>

              {/* Upload Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Select Data Category:
                  </label>
                  <select
                    value={csvDataType}
                    onChange={(e) => setCsvDataType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="students">Student Enrollments (Roll No, Name, Course Section)</option>
                    <option value="courses">Course Sections List (Code, Title, Section, Dept)</option>
                    <option value="timetable">Current Timetable (Day, Slot, Room, Course)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Upload .CSV File:
                  </label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              {/* Paste Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Or Paste CSV Data Directly:
                  </label>
                  <span className="text-[10px] text-gray-400">
                    Comma-separated values with column headers
                  </span>
                </div>
                <textarea
                  placeholder={
                    csvDataType === 'students'
                      ? 'Student ID,Student Name,Course Section Code\n21I-0412,Syed Umar Javed,AI4015 BCS-7B\n...'
                      : csvDataType === 'courses'
                      ? 'Course Code,Course Title,Section,Department,Instructor,Credit Hours\nAI4015,Agentic Artificial Intelligence,BCS-7B,Artificial Intelligence,Dr. Zeeshan Ali,3\n...'
                      : 'Day,TimeSlot,Room,Course Section\nMonday,Slot 2,Room A-1,AI4015 BCS-7B\n...'
                  }
                  value={pastedCSV}
                  onChange={(e) => setPastedCSV(e.target.value)}
                  rows={8}
                  className="w-full p-3 font-mono text-[11px] bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => processCSV(pastedCSV, csvDataType)}
                  disabled={!pastedCSV.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-zinc-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Parse & Apply {csvDataType.toUpperCase()} CSV
                </button>
              </div>
            </div>
          ) : activeTab === 'json' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Paste complete JSON or upload a exported backup file:
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              <textarea
                placeholder='Paste JSON containing { "courses": [...], "students": [...], "rooms": [...], "allocations": [...] }'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={10}
                className="w-full p-3 font-mono text-[11px] bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleJsonImport}
                  disabled={!jsonInput.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Apply JSON Dataset
                </button>
              </div>
            </div>
          ) : activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Full dataset snapshot ready for backup or sharing:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileCode className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                </div>
              </div>

              <textarea
                readOnly
                value={formattedJson}
                rows={12}
                className="w-full p-3 font-mono text-[11px] bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 rounded-xl focus:outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
          ) : (
            /* Student Roster View */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  All {students.length} students currently tracked by the clash engine:
                </p>
                <button
                  onClick={() => handleDownloadCSVTemplate('students')}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3 h-3" />
                  Export Sample Students
                </button>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {student.id} • {student.degreeProgram} (Batch {student.batch})
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {student.enrolledSectionIds.map((cid) => (
                        <span
                          key={cid}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                        >
                          {cid}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 flex items-center justify-between">
          <button
            onClick={resetToDefaultData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-200 dark:border-rose-900"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset to FAST-NUCES Default Data
          </button>

          <button
            onClick={closeDataManager}
            className="px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
