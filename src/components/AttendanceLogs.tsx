import { useState, useMemo, FormEvent } from 'react';
import { AttendanceRecord, Student, AttendanceStatus, AttendanceConfig } from '../types';
import { 
  Calendar, Search, Filter, Edit2, Trash2, 
  FileSpreadsheet, ArrowUpDown, ChevronDown, Check, X,
  AlertCircle, ShieldCheck, PlusCircle, Bookmark, Printer
} from 'lucide-react';

interface AttendanceLogsProps {
  students: Student[];
  records: AttendanceRecord[];
  onUpdateRecord: (recordId: string, updatedStatus: AttendanceStatus, notes?: string) => void;
  onDeleteRecord: (recordId: string) => void;
  onAddManualRecord: (studentId: string, status: AttendanceStatus, date: string, notes?: string) => void;
  activeClass: string;
  config?: AttendanceConfig;
}

export default function AttendanceLogs({
  students,
  records,
  onUpdateRecord,
  onDeleteRecord,
  onAddManualRecord,
  activeClass,
  config
}: AttendanceLogsProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('hadir');
  const [editNotes, setEditNotes] = useState('');

  // Add manual log dialog states
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('hadir');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualNotes, setManualNotes] = useState('');

  // Create lookups
  const studentsMap = useMemo(() => {
    return new Map(students.map(s => [s.id, s]));
  }, [students]);

  // Available students list for manual entries
  const availableStudentsForManual = useMemo(() => {
    if (activeClass === 'Semua Kelas') return students;
    return students.filter(s => s.className === activeClass);
  }, [students, activeClass]);

  // MONTHS in Indonesian
  const MONTHS = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  // Compute number of days in selected month & year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  // Students for Monthly Tabular Grid
  const activeStudents = useMemo(() => {
    return students.filter(s => {
      const matchesClass = activeClass === 'Semua Kelas' || s.className === activeClass;
      const matchesSearch = !searchQuery || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.nis.includes(searchQuery);
      return matchesClass && matchesSearch;
    });
  }, [students, activeClass, searchQuery]);

  // Fast O(1) map of studentId_day to AttendanceRecord for selected month and year
  const monthlyRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach(r => {
      const d = new Date(r.timestamp);
      if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
        const day = d.getDate();
        map.set(`${r.studentId}_${day}`, r);
      }
    });
    return map;
  }, [records, selectedMonth, selectedYear]);

  // Handle click on monthly grid cell to cycle attendance status: Kosong -> Hadir -> Sakit -> Izin -> Alpa -> Kosong
  const handleCellClick = (studentId: string, day: number) => {
    const key = `${studentId}_${day}`;
    const existingRecord = monthlyRecordsMap.get(key);
    
    // Construct local timestamp at 08:00 WIB/local time
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isoString = new Date(`${dateStr}T08:00:00`).toISOString();

    if (existingRecord) {
      const statuses: (AttendanceStatus | 'delete')[] = ['hadir', 'sakit', 'izin', 'alpa', 'delete'];
      const currentIdx = statuses.indexOf(existingRecord.status);
      const nextStatus = statuses[(currentIdx + 1) % statuses.length];

      if (nextStatus === 'delete') {
        onDeleteRecord(existingRecord.id);
      } else {
        onUpdateRecord(existingRecord.id, nextStatus, 'Diubah dari Rekap Bulanan');
      }
    } else {
      onAddManualRecord(studentId, 'hadir', isoString, 'Ditambahkan dari Rekap Bulanan');
    }
  };

  // Export monthly rekap report to CSV
  const handleExportMonthlyCSV = () => {
    const dayCols = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const headerRow = ['NIS', 'Nama Lengkap', 'Kelas', ...dayCols.map(d => `Tgl ${d}`), 'Hadir', 'Sakit', 'Izin', 'Alpa', '% Kehadiran'].join(',');

    const rows = activeStudents.map(student => {
      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alpa = 0;

      const cellValues = dayCols.map(day => {
        const rec = monthlyRecordsMap.get(`${student.id}_${day}`);
        if (!rec) return '-';
        const status = rec.status;
        if (status === 'hadir') { hadir++; return 'H'; }
        if (status === 'sakit') { sakit++; return 'S'; }
        if (status === 'izin') { izin++; return 'I'; }
        if (status === 'alpa') { alpa++; return 'A'; }
        return '-';
      });

      const totalRecorded = hadir + sakit + izin + alpa;
      const rate = totalRecorded > 0 ? Math.round((hadir / totalRecorded) * 100) : 0;

      return [
        `"${student.nis}"`,
        `"${student.name}"`,
        `"${student.className}"`,
        ...cellValues,
        hadir,
        sakit,
        izin,
        alpa,
        `"${rate}%"`
      ].join(',');
    }).join('\n');

    const csvContent = headerRow + '\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Bulanan_${activeClass.replace(/\s+/g, '_')}_${MONTHS[selectedMonth]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print monthly report / Export to PDF via Print Dialog
  const handlePrintMonthlyReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Gagal membuka jendela cetak. Pastikan popup tidak diblokir oleh browser Anda.");
      return;
    }

    const hName = config?.headmasterName || localStorage.getItem('absensi_qr_headmaster_name') || 'Drs. H. Suherman, M.Pd';
    const hNip = config?.headmasterNip || localStorage.getItem('absensi_qr_headmaster_nip') || '197403122005011002';
    const sigImg = config?.signatureImage || localStorage.getItem('absensi_qr_signature_image') || '';
    const stampImg = config?.stampImage || localStorage.getItem('absensi_qr_stamp_image') || '';

    const teacherName = activeClass !== 'Semua Kelas'
      ? (config?.teachers?.[activeClass]?.name || localStorage.getItem(`absensi_qr_teacher_name_${activeClass}`) || '')
      : '';
    const teacherNip = activeClass !== 'Semua Kelas'
      ? (config?.teachers?.[activeClass]?.nip || localStorage.getItem(`absensi_qr_teacher_nip_${activeClass}`) || '')
      : '';

    const dayCols = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const rowsHtml = activeStudents.map((student, index) => {
      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alpa = 0;

      const cellsHtml = dayCols.map(day => {
        const rec = monthlyRecordsMap.get(`${student.id}_${day}`);
        let text = '';
        if (rec) {
          if (rec.status === 'hadir') { hadir++; text = 'H'; }
          else if (rec.status === 'sakit') { sakit++; text = 'S'; }
          else if (rec.status === 'izin') { izin++; text = 'I'; }
          else if (rec.status === 'alpa') { alpa++; text = 'A'; }
        }
        return `<td class="text-center ${text === 'A' ? 'text-red' : text ? 'font-bold' : ''}">${text}</td>`;
      }).join('');

      const totalRecorded = hadir + sakit + izin + alpa;
      const rate = totalRecorded > 0 ? Math.round((hadir / totalRecorded) * 100) : 0;

      return `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${student.nis}</td>
          <td class="student-name">${student.name}</td>
          ${cellsHtml}
          <td class="text-center font-bold text-green">${hadir}</td>
          <td class="text-center font-bold text-blue">${sakit}</td>
          <td class="text-center font-bold text-orange">${izin}</td>
          <td class="text-center font-bold text-red">${alpa}</td>
          <td class="text-center font-bold">${rate}%</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Rekap Kehadiran - ${MONTHS[selectedMonth]} ${selectedYear}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              padding: 20px;
              color: #333;
              font-size: 11px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 {
              margin: 0 0 5px 0;
              font-size: 18px;
              text-transform: uppercase;
            }
            .header p {
              margin: 0;
              font-size: 12px;
              color: #555;
            }
            .info-grid {
              display: flex;
              justify-content: space-between;
              margin-bottom: 15px;
              font-weight: 600;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #444;
              padding: 4px;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
              text-align: center;
              font-size: 10px;
            }
            .student-name {
              text-align: left;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 150px;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-green { color: #059669; }
            .text-blue { color: #2563eb; }
            .text-orange { color: #d97706; }
            .text-red { color: #dc2626; }
            
            .legend {
              display: flex;
              gap: 20px;
              font-size: 11px;
              margin-top: 15px;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 5px;
            }
            .signature-section {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
              padding: 0 40px;
              text-align: center;
              page-break-inside: avoid;
            }
            .signature-box {
              width: 240px;
              position: relative;
            }
            .signature-space {
              height: 70px;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              margin: 5px 0;
            }
            .signature-img {
              max-height: 70px;
              max-width: 140px;
              object-fit: contain;
              position: absolute;
              z-index: 2;
            }
            .stamp-img {
              max-height: 80px;
              max-width: 140px;
              object-fit: contain;
              position: absolute;
              opacity: 0.85;
              z-index: 1;
              left: 15px;
              top: -5px;
            }
            .signature-line {
              border-bottom: 1px solid #333;
              font-weight: bold;
              padding-bottom: 2px;
              margin-bottom: 3px;
            }
            
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { padding: 0; }
              .print-controls { display: none !important; }
            }
            
            .print-controls {
              background: #f8fafc;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .print-btn {
              background: #4f46e5;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="print-controls">
            <div>
              <strong style="font-size: 14px;">Mode Pratinjau Cetak / Ekspor PDF</strong>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Gunakan orientasi Landscape saat mencetak atau menyimpan ke PDF.</div>
            </div>
            <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
          </div>

          <div class="header">
            <h1>LAPORAN REKAPITULASI KEHADIRAN SISWA</h1>
            <p>Bulan: ${MONTHS[selectedMonth]} ${selectedYear}</p>
          </div>
          
          <div class="info-grid">
            <div>Kelas: ${activeClass}</div>
            <div>Jumlah Siswa: ${activeStudents.length}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 20px">No</th>
                <th rowspan="2" style="width: 50px">NIS</th>
                <th rowspan="2" style="min-width: 120px">Nama Siswa</th>
                <th colspan="${daysInMonth}">Tanggal</th>
                <th colspan="4">Total</th>
                <th rowspan="2" style="width: 40px">%</th>
              </tr>
              <tr>
                ${dayCols.map(d => `<th>${d}</th>`).join('')}
                <th style="width: 25px" class="text-green">H</th>
                <th style="width: 25px" class="text-blue">S</th>
                <th style="width: 25px" class="text-orange">I</th>
                <th style="width: 25px" class="text-red">A</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${daysInMonth + 8}" class="text-center" style="padding: 20px;">Tidak ada data siswa</td></tr>`}
            </tbody>
          </table>

          <div class="legend">
            <strong>Keterangan:</strong>
            <div class="legend-item"><span class="font-bold text-green">H</span> : Hadir</div>
            <div class="legend-item"><span class="font-bold text-blue">S</span> : Sakit</div>
            <div class="legend-item"><span class="font-bold text-orange">I</span> : Izin</div>
            <div class="legend-item"><span class="font-bold text-red">A</span> : Alpa / Tanpa Keterangan</div>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div>Mengetahui,</div>
              <div>Kepala Sekolah</div>
              <div class="signature-space">
                ${stampImg ? `<img src="${stampImg}" class="stamp-img" />` : ''}
                ${sigImg ? `<img src="${sigImg}" class="signature-img" />` : ''}
              </div>
              <div class="signature-line">${hName}</div>
              <div>NIP. ${hNip}</div>
            </div>

            <div class="signature-box">
              <div>&nbsp;</div>
              <div>Wali Kelas ${activeClass !== 'Semua Kelas' ? activeClass : '...........'}</div>
              <div class="signature-space"></div>
              <div class="signature-line">${teacherName || '&nbsp;'}</div>
              <div>${teacherNip ? `NIP. ${teacherNip}` : 'NIP. ..........................................'}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const student = studentsMap.get(record.studentId);
      
      // Filter by Class
      const matchesClass = activeClass === 'Semua Kelas' || record.className === activeClass;
      
      // Filter by Date
      const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
      const matchesDate = !selectedDate || recordDate === selectedDate;
      
      // Filter by Status
      const matchesStatus = statusFilter === 'Semua' || record.status === statusFilter.toLowerCase();
      
      // Filter by Search Query (Name/NIS)
      const matchesSearch = !searchQuery || 
        record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (student && student.nis.includes(searchQuery));

      return matchesClass && matchesDate && matchesStatus && matchesSearch;
    });
  }, [records, activeClass, selectedDate, statusFilter, searchQuery, studentsMap]);

  // Calculate stats for this filtered list
  const logStats = useMemo(() => {
    let h = 0;
    let s = 0;
    let i = 0;
    let a = 0;
    
    filteredRecords.forEach(r => {
      if (r.status === 'hadir') h++;
      else if (r.status === 'sakit') s++;
      else if (r.status === 'izin') i++;
      else if (r.status === 'alpa') a++;
    });

    return { hadir: h, sakit: s, izin: i, alpa: a, total: filteredRecords.length };
  }, [filteredRecords]);

  // Export Filtered logs to CSV
  const handleExportLogsCSV = () => {
    const headers = 'Tanggal,Waktu,NIS,Nama Lengkap,Kelas,Status Kehadiran,Metode Verifikasi,Keterangan/Catatan\n';
    const rows = filteredRecords.map(r => {
      const s = studentsMap.get(r.studentId);
      const d = new Date(r.timestamp);
      const formattedDate = d.toLocaleDateString('id-ID');
      const formattedTime = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `"${formattedDate}","${formattedTime}","${s?.nis || '-'}","${r.studentName}","${r.className}","${r.status.toUpperCase()}","${r.verifiedBy === 'qr' ? 'PINDAI QR' : 'MANUAL'}","${r.notes || '-'}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Absensi_${activeClass.replace(/\s+/g, '_')}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startEditing = (record: AttendanceRecord) => {
    setEditingRecordId(record.id);
    setEditStatus(record.status);
    setEditNotes(record.notes || '');
  };

  const saveEditing = (id: string) => {
    onUpdateRecord(id, editStatus, editNotes.trim());
    setEditingRecordId(null);
  };

  const submitManualRecord = (e: FormEvent) => {
    e.preventDefault();
    if (!manualStudentId) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }

    // Set time to current hours or start of day
    const timeWithHours = new Date(manualDate);
    const now = new Date();
    timeWithHours.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    onAddManualRecord(manualStudentId, manualStatus, timeWithHours.toISOString(), manualNotes.trim());
    
    // Reset states
    setManualStudentId('');
    setManualNotes('');
    setIsAddManualOpen(false);
  };

  return (
    <div id="attendance-logs-root" className="space-y-6">
      
      {/* View Mode Segmented Controls */}
      <div className="flex bg-gray-100/70 p-1 rounded-2xl max-w-xs sm:max-w-md border border-gray-100/50">
        <button
          onClick={() => setViewMode('daily')}
          className={`flex-1 py-2 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            viewMode === 'daily'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Jurnal Harian</span>
        </button>
        <button
          onClick={() => setViewMode('monthly')}
          className={`flex-1 py-2 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            viewMode === 'monthly'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Rekap Bulanan (Grid)</span>
        </button>
      </div>

      {viewMode === 'daily' && (
        <>
          {/* Search and Filters Hub */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-gray-900">Jurnal Riwayat Absensi</h4>
            <p className="text-xs text-gray-500">Pantau dan verifikasi ulang riwayat kehadiran harian siswa</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddManualOpen(true)}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl border border-purple-100 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Input Manual</span>
            </button>
            
            <button
              onClick={handleExportLogsCSV}
              disabled={filteredRecords.length === 0}
              className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-150 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Unduh Rekap</span>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          
          {/* 1. Date filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanggal Absen</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                <Calendar className="h-4 w-4" />
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-150 pl-9 pr-3 py-2 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          {/* 2. Status filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status Kehadiran</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-155 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-purple-500 transition-all"
            >
              <option value="Semua">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Sakit">Sakit</option>
              <option value="Izin">Izin</option>
              <option value="Alpa">Alpa</option>
            </select>
          </div>

          {/* 3. Search text */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cari Nama / NIS</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Ketik nama murid atau NIS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-150 pl-9 pr-3 py-2 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-purple-500 transition-all"
              />
            </div>
          </div>

        </div>

        {/* Filter Summary Tags */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-gray-500 border-t border-gray-50">
          <span className="font-semibold text-gray-700">Filter aktif:</span>
          <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md font-medium text-[10px] uppercase">
            {activeClass}
          </span>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium text-[10px] uppercase">
            Tanggal: {selectedDate || 'Semua Waktu'}
          </span>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium text-[10px] uppercase">
            Status: {statusFilter}
          </span>
        </div>

      </div>

      {/* Logs Table Area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        
        {/* Table Stats Overview */}
        <div className="bg-slate-50 px-5 py-3 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="text-xs">
            <span className="block text-gray-400 font-medium">Saring Jurnal</span>
            <span className="font-bold text-gray-800">{logStats.total} Absensi</span>
          </div>
          <div className="text-xs">
            <span className="block text-emerald-600 font-semibold">● Hadir</span>
            <span className="font-bold text-gray-800">{logStats.hadir}</span>
          </div>
          <div className="text-xs">
            <span className="block text-blue-600 font-semibold">● Sakit</span>
            <span className="font-bold text-gray-800">{logStats.sakit}</span>
          </div>
          <div className="text-xs">
            <span className="block text-amber-600 font-semibold">● Izin</span>
            <span className="font-bold text-gray-800">{logStats.izin}</span>
          </div>
          <div className="text-xs">
            <span className="block text-red-600 font-semibold">● Alpa</span>
            <span className="font-bold text-gray-800">{logStats.alpa}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px] bg-gray-50/40">
                <th className="py-3.5 px-4">Nama Siswa / NIS</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4">Tanggal & Jam</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Verifikasi</th>
                <th className="py-3.5 px-4">Catatan</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    <AlertCircle className="h-8 w-8 mx-auto stroke-1 text-gray-300 mb-2" />
                    Belum ada data absensi yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredRecords
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((record) => {
                    const student = studentsMap.get(record.studentId);
                    const isEditing = editingRecordId === record.id;

                    return (
                      <tr 
                        key={record.id} 
                        className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                          isEditing ? 'bg-purple-50/20' : ''
                        }`}
                      >
                        {/* Student Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900 text-sm">{record.studentName}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">NIS: {student?.nis || '-'}</div>
                        </td>

                        {/* Class */}
                        <td className="py-3.5 px-4 font-medium text-gray-600">
                          {record.className}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 font-mono text-gray-600">
                          <div>{new Date(record.timestamp).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{new Date(record.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>

                        {/* Status (Live editing or view) */}
                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                              className="bg-white border border-gray-300 px-2 py-1 rounded-md outline-none text-xs font-semibold uppercase"
                            >
                              <option value="hadir">Hadir</option>
                              <option value="sakit">Sakit</option>
                              <option value="izin">Izin</option>
                              <option value="alpa">Alpa</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                              ${record.status === 'hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : ''}
                              ${record.status === 'sakit' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                              ${record.status === 'izin' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                              ${record.status === 'alpa' ? 'bg-rose-50 text-rose-700 border border-rose-100' : ''}
                            `}>
                              ● {record.status}
                            </span>
                          )}
                        </td>

                        {/* Verification Method */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                            record.verifiedBy === 'qr' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {record.verifiedBy === 'qr' ? 'SCAN QR' : 'MANUAL'}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Alasan / catatan..."
                              className="bg-white border border-gray-300 px-2 py-1 rounded-md outline-none text-xs w-full max-w-[150px]"
                            />
                          ) : (
                            <span className="text-gray-500 font-medium italic">
                              {record.notes || '-'}
                            </span>
                          )}
                        </td>

                        {/* Row Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => saveEditing(record.id)}
                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                                title="Simpan"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingRecordId(null)}
                                className="p-1.5 bg-gray-50 text-gray-500 hover:bg-gray-150 rounded-md transition-colors cursor-pointer"
                                title="Batal"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-1 opacity-80 hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditing(record)}
                                className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md transition-colors cursor-pointer"
                                title="Koreksi Data"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setLogToDelete(record.id)}
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                                title="Hapus Jurnal"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

      </div>
      </>
      )}

      {viewMode === 'monthly' && (
        <>
          {/* Monthly Filters bar */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">Rekapitulasi Kehadiran Bulanan</h4>
                <p className="text-xs text-gray-500">Tampilan rekap harian dalam satu bulan penuh untuk kelas <strong>{activeClass}</strong></p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportMonthlyCSV}
                  disabled={activeStudents.length === 0}
                  className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Unduh (.CSV)</span>
                </button>
                <button
                  onClick={handlePrintMonthlyReport}
                  disabled={activeStudents.length === 0}
                  className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="h-4 w-4 text-purple-600" />
                  <span>Cetak / PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              {/* Month selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-155 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-purple-500 transition-all"
                >
                  {MONTHS.map((name, index) => (
                    <option key={index} value={index}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Year selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tahun</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-155 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-purple-500 transition-all"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Search text filter inside rekap */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cari Nama / NIS</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Saring nama murid atau NIS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-150 pl-9 pr-3 py-2 rounded-xl text-xs font-medium text-gray-700 outline-none focus:bg-white focus:border-purple-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Note legend */}
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-start gap-2 text-xs text-purple-950">
              <AlertCircle className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5 text-purple-900">💡 Tips Interaktif:</strong>
                Anda dapat <strong>mengklik sel tanggal</strong> untuk memperbarui atau mengisi absensi secara langsung.
                Status akan berputar: <span className="font-bold text-emerald-700">H</span> (Hadir) → <span className="font-bold text-blue-700">S</span> (Sakit) → <span className="font-bold text-amber-700">I</span> (Izin) → <span className="font-bold text-rose-700">A</span> (Alpa) → <span className="font-bold text-gray-400">-</span> (Kosong).
              </div>
            </div>
          </div>

          {/* Monthly Tabular Grid Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden animate-in fade-in duration-150">
            
            {/* Table Stats Overview */}
            <div className="bg-slate-50 px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div className="font-semibold text-gray-600 flex items-center gap-1.5">
                <span>Scope Kelas: </span>
                <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase text-[10px]">
                  {activeClass}
                </span>
                <span>• Menampilkan {activeStudents.length} siswa</span>
              </div>
              <div className="flex items-center gap-3 font-bold text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 bg-emerald-50 text-emerald-700 border border-emerald-100/50 rounded-md flex items-center justify-center text-[9px] font-black">H</span> Hadir</span>
                <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 bg-blue-50 text-blue-700 border border-blue-100/50 rounded-md flex items-center justify-center text-[9px] font-black">S</span> Sakit</span>
                <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 bg-amber-50 text-amber-700 border border-amber-100/50 rounded-md flex items-center justify-center text-[9px] font-black">I</span> Izin</span>
                <span className="flex items-center gap-1"><span className="h-3.5 w-3.5 bg-rose-50 text-rose-700 border border-rose-100/50 rounded-md flex items-center justify-center text-[9px] font-black">A</span> Alpa</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[9px] bg-gray-50/40 select-none">
                    <th className="py-3 px-4 bg-white border-r border-gray-100 min-w-[160px] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Siswa / NIS</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      // Highlight current day if matches selected month & year
                      const isToday = new Date().getDate() === day && new Date().getMonth() === selectedMonth && new Date().getFullYear() === selectedYear;
                      return (
                        <th key={day} className={`py-3 px-1 text-center min-w-[32px] border-r border-gray-100/50 ${isToday ? 'bg-purple-100 text-purple-800 font-black' : 'bg-gray-50/20'}`}>
                          {day}
                        </th>
                      );
                    })}
                    <th className="py-3 px-2 text-center bg-emerald-50/40 text-emerald-700 min-w-[36px] border-l border-gray-150">H</th>
                    <th className="py-3 px-2 text-center bg-blue-50/40 text-blue-700 min-w-[36px]">S</th>
                    <th className="py-3 px-2 text-center bg-amber-50/40 text-amber-700 min-w-[36px]">I</th>
                    <th className="py-3 px-2 text-center bg-rose-50/40 text-rose-700 min-w-[36px]">A</th>
                    <th className="py-3 px-3 text-center bg-purple-50/40 text-purple-700 min-w-[50px] border-l border-gray-150">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeStudents.length === 0 ? (
                    <tr>
                      <td colSpan={daysInMonth + 8} className="py-12 text-center text-gray-400 text-sm">
                        <AlertCircle className="h-8 w-8 mx-auto stroke-1 text-gray-300 mb-2" />
                        Tidak ada siswa terdaftar atau cocok dengan pencarian di kelas ini.
                      </td>
                    </tr>
                  ) : (
                    activeStudents.map((student) => {
                      let countHadir = 0;
                      let countSakit = 0;
                      let countIzin = 0;
                      let countAlpa = 0;

                      // Pre-calculate counts for totals
                      for (let day = 1; day <= daysInMonth; day++) {
                        const rec = monthlyRecordsMap.get(`${student.id}_${day}`);
                        if (rec) {
                          if (rec.status === 'hadir') countHadir++;
                          else if (rec.status === 'sakit') countSakit++;
                          else if (rec.status === 'izin') countIzin++;
                          else if (rec.status === 'alpa') countAlpa++;
                        }
                      }

                      const totalRecords = countHadir + countSakit + countIzin + countAlpa;
                      const attendancePercentage = totalRecords > 0 
                        ? Math.round((countHadir / totalRecords) * 100) 
                        : 0;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Student identity, sticky left */}
                          <td className="py-2.5 px-4 bg-white font-bold text-gray-800 border-r border-gray-100 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[160px]">
                            <span className="block truncate max-w-[140px] text-gray-900 leading-tight">{student.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono font-medium mt-0.5 block">NIS: {student.nis}</span>
                          </td>

                          {/* Day cells */}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                            const rec = monthlyRecordsMap.get(`${student.id}_${day}`);
                            let cellText = '-';
                            let cellClass = 'text-gray-300 border-r border-gray-100/50 hover:bg-gray-55';

                            if (rec) {
                              if (rec.status === 'hadir') {
                                cellText = 'H';
                                cellClass = 'bg-emerald-50 text-emerald-700 border-r border-emerald-100/50 hover:bg-emerald-100';
                              } else if (rec.status === 'sakit') {
                                cellText = 'S';
                                cellClass = 'bg-blue-50 text-blue-700 border-r border-blue-100/50 hover:bg-blue-100';
                              } else if (rec.status === 'izin') {
                                cellText = 'I';
                                cellClass = 'bg-amber-50 text-amber-700 border-r border-amber-100/50 hover:bg-amber-100';
                              } else if (rec.status === 'alpa') {
                                cellText = 'A';
                                cellClass = 'bg-rose-50 text-rose-700 border-r border-rose-100/50 hover:bg-rose-100';
                              }
                            }

                            return (
                              <td 
                                key={day} 
                                onClick={() => handleCellClick(student.id, day)}
                                className={`p-1.5 text-center font-bold text-[10px] select-none cursor-pointer transition-colors border-r border-gray-100/50 ${cellClass}`}
                                title={`Klik untuk ubah kehadiran ${student.name} tgl ${day} ${MONTHS[selectedMonth]}`}
                              >
                                {cellText}
                              </td>
                            );
                          })}

                          {/* Aggregate stats */}
                          <td className="py-2.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/10 border-l border-gray-150">{countHadir}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-blue-700 bg-blue-50/10">{countSakit}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-amber-700 bg-amber-50/10">{countIzin}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-rose-700 bg-rose-50/10">{countAlpa}</td>
                          <td className={`py-2.5 px-3 text-center font-black border-l border-gray-150 ${
                            attendancePercentage >= 90 ? 'text-emerald-700 bg-emerald-50/20' :
                            attendancePercentage >= 75 ? 'text-blue-700 bg-blue-50/20' :
                            attendancePercentage > 0 ? 'text-rose-700 bg-rose-50/20' : 'text-gray-400'
                          }`}>
                            {attendancePercentage}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DIALOG: INPUT MANUAL ABSENSI BARU */}
      {isAddManualOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-lg">Input Jurnal Absensi Manual</h4>
                <p className="text-xs text-purple-100 mt-0.5">Lakukan koreksi atau absensi offline untuk siswa</p>
              </div>
              <button 
                onClick={() => setIsAddManualOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitManualRecord} className="p-6 space-y-4">
              {/* Select Student */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Pilih Siswa <span className="text-red-500">*</span></label>
                <select
                  required
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                >
                  <option value="">-- Pilih Siswa Kelas {activeClass} --</option>
                  {availableStudentsForManual.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (NIS: {s.nis})</option>
                  ))}
                </select>
              </div>

              {/* Status and Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status Absen</label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as AttendanceStatus)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                  >
                    <option value="hadir">Hadir</option>
                    <option value="sakit">Sakit</option>
                    <option value="izin">Izin</option>
                    <option value="alpa">Alpa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Keterangan / Alasan</label>
                <input
                  type="text"
                  placeholder="Contoh: Lupa bawa kartu, Izin keluarga..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                />
              </div>

              {/* Submit Toggles */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddManualOpen(false)}
                  className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  Simpan Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE LOG CONFIRMATION */}
      {logToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Hapus Jurnal?</h3>
              <p className="text-sm text-gray-500">
                Apakah Anda yakin ingin menghapus jurnal kehadiran ini secara permanen?
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setLogToDelete(null)}
                className="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteRecord(logToDelete);
                  setLogToDelete(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm shadow-red-200"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
