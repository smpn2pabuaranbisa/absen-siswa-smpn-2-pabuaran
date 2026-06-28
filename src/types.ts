export interface Student {
  id: string; // Unique student ID, also used inside QR code
  nis: string; // Nomor Induk Siswa (ID Number)
  name: string;
  gender: 'L' | 'P'; // Laki-laki / Perempuan
  className: string; // Kelas
  status?: string; // Optional temporary status
  photo?: string; // Optional Base64 image URL for student profile photo
  parentPhone?: string; // WhatsApp number of parents
}

export type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  timestamp: string; // ISO String format
  status: AttendanceStatus;
  verifiedBy: 'qr' | 'manual';
  notes?: string;
}

export interface AttendanceConfig {
  schoolName: string;
  checkInStart: string; // e.g. "06:30"
  checkInEnd: string;   // e.g. "08:00"
  selectedClassFilter: string; // Default or current selected class
  customClasses?: string[];
  waAutoSend?: boolean;
  waProvider?: 'fonnte' | 'custom';
  waApiToken?: string; // For Fonnte
  waApiUrl?: string; // For Custom
  waApiHeaders?: string; // For Custom, JSON string
  waApiPayload?: string; // For Custom, JSON string template
  isConfigured?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'holiday' | 'exam' | 'activity' | 'meeting';
  description?: string;
}

export interface StatsSummary {
  totalStudents: number;
  presentToday: number;
  sickToday: number;
  excusedToday: number;
  absentToday: number;
  attendanceRate: number;
}
