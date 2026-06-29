import { Student, AttendanceRecord, AttendanceConfig } from '../types';

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_CONFIG: AttendanceConfig = {
  schoolName: "",
  checkInStart: "06:45",
  checkInEnd: "07:30",
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
