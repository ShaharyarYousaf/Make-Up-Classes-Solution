import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TimeInterval, TimeSlot } from "../types/timetable";
import { STANDARD_TIME_SLOTS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatTime12Hour(timeStr: string): string {
  const [hours24, minutes] = timeStr.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Checks if two open intervals [startA, endA) and [startB, endB) overlap.
 * Strictly: startA < endB && startB < endA
 */
export function isTimeOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Resolves standard TimeSlot or custom interval into startMinutes & endMinutes
 */
export function getAllocationInterval(
  slotId: string,
  customInterval?: TimeInterval
): { startMinutes: number; endMinutes: number; startTime: string; endTime: string } {
  if (customInterval) {
    return customInterval;
  }
  const standardSlot = STANDARD_TIME_SLOTS.find(s => s.id === slotId);
  if (standardSlot) {
    return {
      startMinutes: standardSlot.startMinutes,
      endMinutes: standardSlot.endMinutes,
      startTime: standardSlot.startTime,
      endTime: standardSlot.endTime,
    };
  }
  // Default fallback
  return {
    startMinutes: 510,
    endMinutes: 590,
    startTime: '08:30',
    endTime: '09:50',
  };
}
