import { Student, AttendanceRecord, AttendanceConfig } from '../types';
import { getDefaultDailySchedule } from '../lib/schedule';

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_CONFIG: AttendanceConfig = {
  schoolName: "",
  checkInStart: "06:45",
  checkInEnd: "07:30",
  checkOutStart: "14:00",
  dailySchedule: getDefaultDailySchedule("06:45", "07:30", "14:00"),
  selectedClassFilter: "Semua Kelas",
  customClasses: [],
  waAutoSend: false,
  waApiToken: "",
  isConfigured: false
};

// Generate historical logs for the past 7 days (except Sunday)
export function generateMockAttendance(): AttendanceRecord[] {
  return [];
}
