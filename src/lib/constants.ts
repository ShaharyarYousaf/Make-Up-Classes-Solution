import { DayOfWeek, TimeSlot } from '../types/timetable';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const STANDARD_TIME_SLOTS: TimeSlot[] = [
  {
    id: 'slot-1',
    slotNumber: 1,
    label: 'Slot 1 (08:30 - 09:50)',
    startTime: '08:30',
    endTime: '09:50',
    startMinutes: 8 * 60 + 30, // 510
    endMinutes: 9 * 60 + 50,   // 590
    isStandard: true,
  },
  {
    id: 'slot-2',
    slotNumber: 2,
    label: 'Slot 2 (10:00 - 11:20)',
    startTime: '10:00',
    endTime: '11:20',
    startMinutes: 10 * 60,     // 600
    endMinutes: 11 * 60 + 20,  // 680
    isStandard: true,
  },
  {
    id: 'slot-3',
    slotNumber: 3,
    label: 'Slot 3 (11:30 - 12:50)',
    startTime: '11:30',
    endTime: '12:50',
    startMinutes: 11 * 60 + 30, // 690
    endMinutes: 12 * 60 + 50,  // 770
    isStandard: true,
  },
  {
    id: 'slot-4',
    slotNumber: 4,
    label: 'Slot 4 (01:00 - 02:20)',
    startTime: '13:00',
    endTime: '14:20',
    startMinutes: 13 * 60,     // 780
    endMinutes: 14 * 60 + 20,  // 860
    isStandard: true,
  },
  {
    id: 'slot-5',
    slotNumber: 5,
    label: 'Slot 5 (02:30 - 03:50)',
    startTime: '14:30',
    endTime: '15:50',
    startMinutes: 14 * 60 + 30, // 870
    endMinutes: 15 * 60 + 50,  // 950
    isStandard: true,
  },
  {
    id: 'slot-6',
    slotNumber: 6,
    label: 'Slot 6 (03:55 - 05:15)',
    startTime: '15:55',
    endTime: '17:15',
    startMinutes: 15 * 60 + 55, // 955
    endMinutes: 17 * 60 + 15,  // 1035
    isStandard: true,
  },
  {
    id: 'slot-7',
    slotNumber: 7,
    label: 'Evening 1 (05:20 - 06:40)',
    startTime: '17:20',
    endTime: '18:40',
    startMinutes: 17 * 60 + 20, // 1040
    endMinutes: 18 * 60 + 40,   // 1120
    isStandard: false,
  },
  {
    id: 'slot-8',
    slotNumber: 8,
    label: 'Evening 2 (06:45 - 08:05)',
    startTime: '18:45',
    endTime: '20:05',
    startMinutes: 18 * 60 + 45, // 1125
    endMinutes: 20 * 60 + 5,    // 1205
    isStandard: false,
  },
  {
    id: 'lab-1',
    slotNumber: 9,
    label: 'Lab Morning (08:30 - 11:15)',
    startTime: '08:30',
    endTime: '11:15',
    startMinutes: 8 * 60 + 30,  // 510
    endMinutes: 11 * 60 + 15,  // 675
    isStandard: false,
  },
  {
    id: 'lab-2',
    slotNumber: 10,
    label: 'Lab Midday (11:30 - 02:15)',
    startTime: '11:30',
    endTime: '14:15',
    startMinutes: 11 * 60 + 30, // 690
    endMinutes: 14 * 60 + 15,  // 855
    isStandard: false,
  },
  {
    id: 'lab-3',
    slotNumber: 11,
    label: 'Lab Afternoon (02:30 - 05:15)',
    startTime: '14:30',
    endTime: '17:15',
    startMinutes: 14 * 60 + 30, // 870
    endMinutes: 17 * 60 + 15,  // 1035
    isStandard: false,
  },
  {
    id: 'lab-4',
    slotNumber: 12,
    label: 'Lab Evening (05:20 - 08:05)',
    startTime: '17:20',
    endTime: '20:05',
    startMinutes: 17 * 60 + 20, // 1040
    endMinutes: 20 * 60 + 5,   // 1205
    isStandard: false,
  },
];

// Campus operating bounds (08:00 to 20:30)
export const CAMPUS_DAY_START_MINUTES = 8 * 60;   // 480 (08:00)
export const CAMPUS_DAY_END_MINUTES = 20 * 60 + 15; // 1215 (20:15)
