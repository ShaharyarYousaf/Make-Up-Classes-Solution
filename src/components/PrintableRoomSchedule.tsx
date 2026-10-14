import React from 'react';
import { Allocation, CourseSection, Room } from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_TIME_SLOTS } from '../lib/constants';
import { getReservedLabel, isReservedAllocation } from '../lib/csvParser';
import { allocationInterval, layoutLanes } from '../lib/timeline';
import { minutesToTimeString } from '../lib/utils';

/** Height of the day grid on an A4 landscape page, in millimetres */
const GRID_HEIGHT_MM = 150;

interface PrintableRoomScheduleProps {
  room: Room;
  allocations: Allocation[];
  courseMap: Map<string, CourseSection>;
  dayStart: number;
  dayEnd: number;
  showTeacher: boolean;
  printedOn: string;
  termLabel: string;
}

const fmt = minutesToTimeString;

/** One A4 landscape page: a room's weekly timetable at exact times, for posting outside the door. */
export const PrintableRoomSchedule: React.FC<PrintableRoomScheduleProps> = ({
  room,
  allocations,
  courseMap,
  dayStart,
  dayEnd,
  showTeacher,
  printedOn,
  termLabel,
}) => {
  const mmPerMinute = GRID_HEIGHT_MM / (dayEnd - dayStart);
  const y = (minutes: number) => `${(minutes - dayStart) * mmPerMinute}mm`;
  const h = (minutes: number) => `${minutes * mmPerMinute}mm`;
  const isLabRoom = room.type === 'Lab';
  const bands = STANDARD_TIME_SLOTS.filter(
    (s) => (isLabRoom ? s.id.startsWith('lab') : !s.id.startsWith('lab')) && s.startMinutes < dayEnd && s.endMinutes > dayStart
  );
  const classCount = allocations.filter((a) => !isReservedAllocation(a.courseSectionId)).length;

  return (
    <section className="print-page">
      <header className="print-header">
        <img src="/branding/fast-nu-logo.png" alt="" className="print-logo" />
        <div className="print-title">
          <h1>{room.name}</h1>
          <p>
            {room.type}
            {room.capacity > 0 ? ` · ${room.capacity} seats` : ''}
            {room.building && room.building !== 'Unknown' ? ` · ${room.building}` : ''}
          </p>
        </div>
        <div className="print-meta">
          <strong>{termLabel}</strong>
          <span>Weekly room schedule · {classCount} classes</span>
          <span>Printed {printedOn}</span>
        </div>
      </header>

      <div className="print-grid">
        {/* Time axis */}
        <div className="print-axis-head" />
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="print-day-head">
            {day}
          </div>
        ))}

        <div className="print-axis" style={{ height: `${GRID_HEIGHT_MM}mm` }}>
          {bands.map((slot) => (
            <div key={slot.id} className="print-axis-slot" style={{ top: y(slot.startMinutes), height: h(slot.endMinutes - slot.startMinutes) }}>
              <span>{slot.id.startsWith('lab') ? `Lab ${slot.slotNumber - 8}` : `Slot ${slot.slotNumber}`}</span>
              <span className="print-axis-time">
                {slot.startTime}–{slot.endTime}
              </span>
            </div>
          ))}
        </div>

        {DAYS_OF_WEEK.map((day) => {
          const dayAllocations = allocations.filter((a) => a.day === day);
          return (
            <div key={day} className="print-day" style={{ height: `${GRID_HEIGHT_MM}mm` }}>
              {bands.map((slot) => (
                <div key={slot.id} className="print-band" style={{ top: y(slot.startMinutes), height: h(slot.endMinutes - slot.startMinutes) }} />
              ))}
              {layoutLanes(dayAllocations, allocationInterval).map(({ item: alloc, startMinutes, endMinutes, lane, lanes }) => {
                const course = courseMap.get(alloc.courseSectionId);
                const reserved = !course;
                const style: React.CSSProperties = {
                  top: y(startMinutes),
                  height: h(endMinutes - startMinutes),
                  left: `${(lane / lanes) * 100}%`,
                  width: `${100 / lanes}%`,
                };
                const short = endMinutes - startMinutes < 70;
                return (
                  <div key={alloc.id} className={`print-block ${reserved ? 'print-block-reserved' : ''}`} style={style}>
                    {reserved ? (
                      <span className="print-block-title">
                        {isReservedAllocation(alloc.courseSectionId) ? getReservedLabel(alloc.courseSectionId) : alloc.courseSectionId}
                      </span>
                    ) : (
                      <>
                        <span className="print-block-code">
                          {course.courseCode} <span className="print-block-section">{course.section}</span>
                          {alloc.isRescheduled && <span className="print-block-tag">Rescheduled</span>}
                        </span>
                        {!short && <span className="print-block-title">{course.courseTitle}</span>}
                        {showTeacher && !short && course.instructor && (
                          <span className="print-block-teacher">{course.instructor}</span>
                        )}
                      </>
                    )}
                    <span className="print-block-time">
                      {fmt(startMinutes)}–{fmt(endMinutes)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <footer className="print-footer">
        FAST-NUCES Islamabad · Make-Up Class Scheduler · Times are exact; changes after {printedOn} are not shown.
      </footer>
    </section>
  );
};
