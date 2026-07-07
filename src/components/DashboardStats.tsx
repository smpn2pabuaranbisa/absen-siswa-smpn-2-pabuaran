import { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid 
} from 'recharts';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { 
  Users, CheckCircle, AlertCircle, HelpCircle, 
  Calendar, TrendingUp, Award, UserCheck, AlertTriangle 
} from 'lucide-react';

interface DashboardStatsProps {
  students: Student[];
  records: AttendanceRecord[];
  activeClass: string;
}

export default function DashboardStats({ students, records, activeClass }: DashboardStatsProps) {
  // Filter students based on selected class
  const filteredStudents = useMemo(() => {
    if (activeClass === 'Semua Kelas') return students;
    return students.filter(s => s.className === activeClass);
  }, [students, activeClass]);

  const studentIdsInClass = useMemo(() => {
    return new Set(filteredStudents.map(s => s.id));
  }, [filteredStudents]);

  // Today's records
  const todayRecords = useMemo(() => {
    const todayStr = new Date().toDateString();
    return records.filter(r => {
      const isToday = new Date(r.timestamp).toDateString() === todayStr;
      const isCorrectClass = studentIdsInClass.has(r.studentId);
      return isToday && isCorrectClass;
    });
  }, [records, studentIdsInClass]);

  // Calculations for Today's Stats
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const recordedIds = new Set(todayRecords.map(r => r.studentId));
    
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    // To prevent double counting students with both Datang and Pulang,
    // we take only the latest record for each student today for stats
    const latestRecordPerStudent = new Map<string, AttendanceRecord>();
    todayRecords.forEach(r => {
      const existing = latestRecordPerStudent.get(r.studentId);
      if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
        latestRecordPerStudent.set(r.studentId, r);
      }
    });

    latestRecordPerStudent.forEach(r => {
      if (r.status === 'hadir') hadir++;
      else if (r.status === 'sakit') sakit++;
      else if (r.status === 'izin') izin++;
      else if (r.status === 'alpa') alpa++;
    });

    // Any student who is NOT marked yet is "Belum Absen"
    const belumAbsen = Math.max(0, total - recordedIds.size);
    // Let's assume unmarked are implicitly "Alpa" for final calculations or just count active checked-in percentage
    const totalMarked = hadir + sakit + izin + alpa;
    const attendanceRate = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return {
      total,
      hadir,
      sakit,
      izin,
      alpa: alpa + belumAbsen, // Treat unmarked as absent/alpa in stats for strict monitoring
      belumAbsen,
      attendanceRate
    };
  }, [filteredStudents, todayRecords]);

  // 1. Data for Pie Chart: Today's Attendance Distribution
  const pieData = useMemo(() => {
    return [
      { name: 'Hadir', value: stats.hadir, color: '#10B981' }, // emerald-500
      { name: 'Sakit', value: stats.sakit, color: '#3B82F6' }, // blue-500
      { name: 'Izin', value: stats.izin, color: '#F59E0B' },  // amber-500
      { name: 'Alpa / Belum', value: stats.alpa, color: '#EF4444' }, // red-500
    ].filter(item => item.value > 0);
  }, [stats]);

  // 2. Data for Line/Bar Chart: Weekly Attendance Trend
  const weeklyTrends = useMemo(() => {
    // Group records by Date
    const daysMap: { [key: string]: { date: string; displayDate: string; hadir: number; total: number } } = {};
    const last7Days: Date[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (d.getDay() === 0) continue; // Skip Sundays

      const key = d.toDateString();
      const display = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      daysMap[key] = {
        date: key,
        displayDate: display,
        hadir: 0,
        total: filteredStudents.length
      };
      last7Days.push(d);
    }

    const processedStudentIdsPerDay = new Map<string, Set<string>>();

    records.forEach(r => {
      const rDate = new Date(r.timestamp);
      const key = rDate.toDateString();
      if (daysMap[key] && studentIdsInClass.has(r.studentId)) {
        let setForDay = processedStudentIdsPerDay.get(key);
        if (!setForDay) {
          setForDay = new Set();
          processedStudentIdsPerDay.set(key, setForDay);
        }

        if (r.status === 'hadir' && !setForDay.has(r.studentId)) {
          daysMap[key].hadir++;
          setForDay.add(r.studentId);
        }
      }
    });

    return Object.values(daysMap);
  }, [records, filteredStudents, studentIdsInClass]);

  return (
    <div id="dashboard-stats-root" className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Siswa */}
        <div id="stat-card-total" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Siswa</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{activeClass}</p>
          </div>
        </div>

        {/* Kehadiran (%) */}
        <div id="stat-card-rate" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Rasio Hadir</p>
            <div className="flex items-baseline space-x-1">
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.attendanceRate}%</h3>
              <span className="text-xs text-emerald-600 font-medium">Hari ini</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${stats.attendanceRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Siswa Hadir & Sakit */}
        <div id="stat-card-present" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Hadir</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.hadir} <span className="text-xs text-gray-400 font-normal">Siswa</span></h3>
            <p className="text-xs text-emerald-600 mt-0.5">Sakit: {stats.sakit} | Izin: {stats.izin}</p>
          </div>
        </div>

        {/* Alpa & Belum Absen */}
        <div id="stat-card-absent" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Alpa / Belum</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats.alpa} <span className="text-xs text-gray-400 font-normal">Siswa</span></h3>
            <p className="text-xs text-rose-600 mt-0.5">Belum tap QR: {stats.belumAbsen}</p>
          </div>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly Trend Line Chart */}
        <div id="weekly-trend-chart-card" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">Tren Kehadiran Mingguan</h4>
                <p className="text-xs text-gray-500">Jumlah siswa yang hadir tap QR atau manual</p>
              </div>
              <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> 7 Hari Aktif
              </span>
            </div>

            <div className="h-[260px] w-full">
              {weeklyTrends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Calendar className="h-8 w-8 mb-2 stroke-1" />
                  <p className="text-sm">Belum ada data historis absensi</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                      dataKey="displayDate" 
                      tick={{ fill: '#6B7280', fontSize: 11 }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#6B7280', fontSize: 11 }} 
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', borderRadius: '12px', border: 'none', color: '#fff' }}
                      labelStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="hadir" 
                      name="Hadir" 
                      stroke="#10B981" 
                      strokeWidth={3} 
                      activeDot={{ r: 6 }} 
                      dot={{ r: 3, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div id="pie-distribution-card" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-gray-900 mb-1">Status Kehadiran Hari Ini</h4>
            <p className="text-xs text-gray-500 mb-4">Distribusi persentase status absensi hari ini</p>
            
            <div className="h-[200px] w-full flex items-center justify-center relative">
              {pieData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <AlertCircle className="h-8 w-8 mb-2 stroke-1" />
                  <p className="text-sm">Belum ada absensi hari ini</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', borderRadius: '12px', border: 'none', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {pieData.length > 0 && (
                <div className="absolute text-center">
                  <span className="text-2xl font-black text-gray-900">{stats.hadir}</span>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Siswa Hadir</p>
                </div>
              )}
            </div>
          </div>

          {/* Custom Legends */}
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                <span className="text-gray-600 font-medium">Hadir: {stats.hadir}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
                <span className="text-gray-600 font-medium">Sakit: {stats.sakit}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                <span className="text-gray-600 font-medium">Izin: {stats.izin}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block"></span>
                <span className="text-gray-600 font-medium">Alpa: {stats.alpa}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Quick Attendance Checklist For Today */}
      <div id="quick-checklist-today" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <h4 className="text-base font-bold text-gray-900 mb-1">Status Kehadiran Cepat Hari Ini</h4>
        <p className="text-xs text-gray-500 mb-4">Siswa yang sudah absensi hari ini di kelas <strong className="text-purple-600">{activeClass}</strong></p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-medium text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Waktu Absen</th>
                <th className="py-3 px-4">Metode</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 text-sm">
                    Tidak ada siswa di kelas ini.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const attendanceToday = todayRecords.find(r => r.studentId === student.id);
                  return (
                    <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-400 font-mono">NIS: {student.nis}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{student.className}</td>
                      <td className="py-3 px-4">
                        {attendanceToday ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide
                            ${attendanceToday.status === 'hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : ''}
                            ${attendanceToday.status === 'sakit' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                            ${attendanceToday.status === 'izin' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                            ${attendanceToday.status === 'alpa' ? 'bg-rose-50 text-rose-700 border border-rose-100' : ''}
                          `}>
                            {attendanceToday.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-gray-50 text-gray-400 border border-gray-200">
                            Belum Absen
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                        {attendanceToday ? new Date(attendanceToday.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {attendanceToday ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] uppercase tracking-wider ${
                            attendanceToday.verifiedBy === 'qr' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {attendanceToday.verifiedBy === 'qr' ? 'QR SCAN' : 'MANUAL'}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
