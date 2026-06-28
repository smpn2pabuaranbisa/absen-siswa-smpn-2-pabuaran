import { Student, AttendanceRecord, AttendanceConfig } from '../types';

export const INITIAL_STUDENTS: Student[] = [
  { id: "STD-001", nis: "21001", name: "Ahmad Fauzi", gender: "L", className: "XII MIPA 1" },
  { id: "STD-002", nis: "21002", name: "Budi Santoso", gender: "L", className: "XII MIPA 1" },
  { id: "STD-003", nis: "21003", name: "Citra Lestari", gender: "P", className: "XII MIPA 1" },
  { id: "STD-004", nis: "21004", name: "Dewi Sartika", gender: "P", className: "XII MIPA 1" },
  { id: "STD-005", nis: "21005", name: "Eko Prasetyo", gender: "L", className: "XII MIPA 1" },
  { id: "STD-006", nis: "21006", name: "Farhan Wijaya", gender: "L", className: "XII MIPA 1" },
  { id: "STD-007", nis: "21007", name: "Gita Amanda", gender: "P", className: "XII MIPA 1" },
  { id: "STD-008", nis: "21008", name: "Hadi Kusuma", gender: "L", className: "XII MIPA 1" },
  { id: "STD-009", nis: "21009", name: "Indah Permata", gender: "P", className: "XII MIPA 1" },
  { id: "STD-010", nis: "21010", name: "Joni Iskandar", gender: "L", className: "XII MIPA 1" },
  
  { id: "STD-011", nis: "22011", name: "Kartika Putri", gender: "P", className: "XI IPS 2" },
  { id: "STD-012", nis: "22012", name: "Luthfi Hakim", gender: "L", className: "XI IPS 2" },
  { id: "STD-013", nis: "22013", name: "Mega Utami", gender: "P", className: "XI IPS 2" },
  { id: "STD-014", nis: "22014", name: "Naufal Rabbani", gender: "L", className: "XI IPS 2" },
  { id: "STD-015", nis: "22015", name: "Olivia Maharani", gender: "P", className: "XI IPS 2" }
];

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
  const records: AttendanceRecord[] = [];
  const today = new Date();
  
  // Custom helper to construct past date times
  for (let i = 7; i >= 1; i--) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i);
    
    // Skip Sunday (day 0)
    if (currentDate.getDay() === 0) continue;
    
    INITIAL_STUDENTS.forEach((student, index) => {
      // Create random status based on index to keep it realistic
      let status: 'hadir' | 'sakit' | 'izin' | 'alpa' = 'hadir';
      const rand = (index + i * 3) % 20;
      
      if (rand === 18) {
        status = 'sakit';
      } else if (rand === 19) {
        status = 'izin';
      } else if (rand === 17 && index % 4 === 0) {
        status = 'alpa';
      }
      
      const hour = 6 + Math.floor(Math.random() * 2);
      const minute = Math.floor(Math.random() * 60);
      const recordDate = new Date(currentDate);
      recordDate.setHours(hour, minute, 0, 0);
      
      records.push({
        id: `REC-${recordDate.getTime()}-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        className: student.className,
        timestamp: recordDate.toISOString(),
        status: status,
        verifiedBy: Math.random() > 0.3 ? 'qr' : 'manual',
        notes: status !== 'hadir' ? (status === 'sakit' ? 'Surat dokter' : 'Keluarga') : undefined
      });
    });
  }
  
  return records;
}
