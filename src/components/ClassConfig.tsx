import { useState, useMemo, useEffect, FormEvent, ChangeEvent } from 'react';
import { AttendanceConfig, Student, AttendanceRecord } from '../types';
import { 
  School, Clock, Sliders, Save, Database, 
  Trash2, Plus, Download, Upload, RefreshCw, Check, 
  Settings, Layers, BookOpen, AlertCircle
} from 'lucide-react';

interface ClassConfigProps {
  config: AttendanceConfig;
  onUpdateConfig: (updated: AttendanceConfig) => void;
  students: Student[];
  records: AttendanceRecord[];
  onResetDatabase: () => void;
  onRestoreDatabase: (students: Student[], records: AttendanceRecord[], config: AttendanceConfig) => void;
}

export default function ClassConfig({
  config,
  onUpdateConfig,
  students,
  records,
  onResetDatabase,
  onRestoreDatabase
}: ClassConfigProps) {
  // Input fields state
  const [schoolName, setSchoolName] = useState(config.schoolName);
  const [checkInStart, setCheckInStart] = useState(config.checkInStart);
  const [checkInEnd, setCheckInEnd] = useState(config.checkInEnd);
  const [waAutoSend, setWaAutoSend] = useState(config.waAutoSend || false);
  const [waProvider, setWaProvider] = useState<'fonnte' | 'custom'>(config.waProvider || 'fonnte');
  const [waApiToken, setWaApiToken] = useState(config.waApiToken || '');
  const [waApiUrl, setWaApiUrl] = useState(config.waApiUrl || '');
  const [waApiHeaders, setWaApiHeaders] = useState(config.waApiHeaders || '{"Content-Type": "application/json"}');
  const [waApiPayload, setWaApiPayload] = useState(config.waApiPayload || '{"target": "{{phone}}", "message": "{{message}}"}');
  const [logoUrl, setLogoUrl] = useState(config.logoUrl || '');
  
  // Headmaster states
  const [headmasterName, setHeadmasterName] = useState(() => {
    return config.headmasterName || localStorage.getItem('absensi_qr_headmaster_name') || 'Drs. H. Suherman, M.Pd';
  });
  const [headmasterNip, setHeadmasterNip] = useState(() => {
    return config.headmasterNip || localStorage.getItem('absensi_qr_headmaster_nip') || '197403122005011002';
  });
  const [academicYear, setAcademicYear] = useState(() => {
    return config.academicYear || localStorage.getItem('absensi_qr_academic_year') || 'TA. 2026/2027';
  });

  // Keep local states in sync when global config changes
  useEffect(() => {
    if (config.headmasterName) setHeadmasterName(config.headmasterName);
    if (config.headmasterNip) setHeadmasterNip(config.headmasterNip);
    if (config.academicYear) setAcademicYear(config.academicYear);
  }, [config.headmasterName, config.headmasterNip, config.academicYear]);
  
  // Custom class list state
  const [newClassName, setNewClassName] = useState('');
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const [confirmRestoreData, setConfirmRestoreData] = useState<any | null>(null);
  const [confirmResetData, setConfirmResetData] = useState<boolean>(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Editing class teacher details states
  const [editingClassTeacher, setEditingClassTeacher] = useState<string | null>(null);
  const [editingTeacherName, setEditingTeacherName] = useState('');
  const [editingTeacherNip, setEditingTeacherNip] = useState('');

  // Extract list of current unique classes
  const uniqueClasses = useMemo(() => {
    const classes = new Set(students.map(s => s.className));
    if (config.customClasses) {
      config.customClasses.forEach(c => classes.add(c));
    }
    return Array.from(classes).sort();
  }, [students, config.customClasses]);

  const handleSaveConfig = (e: FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      ...config,
      schoolName: schoolName.trim(),
      checkInStart,
      checkInEnd,
      waAutoSend,
      waProvider,
      waApiToken: waApiToken.trim(),
      waApiUrl: waApiUrl.trim(),
      waApiHeaders: waApiHeaders.trim(),
      waApiPayload: waApiPayload.trim(),
      logoUrl,
      headmasterName: headmasterName.trim(),
      headmasterNip: headmasterNip.trim(),
      academicYear: academicYear.trim(),
    });
    
    localStorage.setItem('absensi_qr_headmaster_name', headmasterName.trim());
    localStorage.setItem('absensi_qr_headmaster_nip', headmasterNip.trim());
    localStorage.setItem('absensi_qr_academic_year', academicYear.trim());
    
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3000);
  };

  const handleAddNewClass = (e: FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const classCapitalized = newClassName.trim().toUpperCase();
    if (uniqueClasses.includes(classCapitalized)) {
      setAlertMessage(`Kelas ${classCapitalized} sudah terdaftar!`);
      return;
    }

    const currentCustom = config.customClasses || [];
    onUpdateConfig({
      ...config,
      customClasses: [...currentCustom, classCapitalized]
    });

    setAlertMessage(`Rombel Kelas "${classCapitalized}" berhasil dibuat! Anda sekarang dapat memilih kelas ini saat mendaftarkan siswa baru.`);
    setNewClassName('');
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g., max 500KB to prevent Firestore/LocalStorage bloating)
    if (file.size > 500 * 1024) {
      setAlertMessage('Ukuran logo terlalu besar. Maksimal 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteClass = (classNameToDelete: string) => {
    const studentCount = students.filter(s => s.className === classNameToDelete).length;
    if (studentCount > 0) {
      setAlertMessage(`Tidak dapat menghapus Rombel "${classNameToDelete}" karena masih memiliki ${studentCount} siswa terdaftar. Hapus atau pindahkan siswa terlebih dahulu.`);
      return;
    }

    const currentCustom = config.customClasses || [];
    const updatedCustom = currentCustom.filter(c => c !== classNameToDelete);
    onUpdateConfig({
      ...config,
      customClasses: updatedCustom
    });
    setAlertMessage(`Rombel "${classNameToDelete}" berhasil dihapus.`);
  };

  // Export full app DB backup to JSON file
  const handleExportBackup = () => {
    const teachers: Record<string, { name: string; nip: string }> = {};
    uniqueClasses.forEach(className => {
      const name = localStorage.getItem(`absensi_qr_teacher_name_${className}`);
      const nip = localStorage.getItem(`absensi_qr_teacher_nip_${className}`);
      if (name || nip) {
        teachers[className] = { name: name || '', nip: nip || '' };
      }
    });

    const backupData = {
      students,
      records,
      config,
      signatureImage: localStorage.getItem('absensi_qr_signature_image'),
      stampImage: localStorage.getItem('absensi_qr_stamp_image'),
      idCardConfig: localStorage.getItem('absensi_qr_idcard_config'),
      headmasterName: localStorage.getItem('absensi_qr_headmaster_name'),
      headmasterNip: localStorage.getItem('absensi_qr_headmaster_nip'),
      academicYear: localStorage.getItem('absensi_qr_academic_year'),
      teachers,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CADANGAN_ABSENSI_${schoolName.toUpperCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restore DB from JSON file
  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.students && data.records && data.config) {
          setConfirmRestoreData(data);
        } else {
          setAlertMessage('Format berkas JSON cadangan tidak cocok.');
        }
      } catch (err) {
        setAlertMessage('Gagal membaca berkas. Pastikan berkas JSON cadangan asli.');
      }
    };
    reader.readAsText(file);
    // Reset file input target
    e.target.value = '';
  };

  const processRestore = () => {
    if (!confirmRestoreData) return;
    const data = confirmRestoreData;
    onRestoreDatabase(data.students, data.records, data.config);
    
    // Restore visual assets (Tanda Tangan & Stempel)
    if (data.signatureImage) localStorage.setItem('absensi_qr_signature_image', data.signatureImage);
    else localStorage.removeItem('absensi_qr_signature_image');
    
    if (data.stampImage) localStorage.setItem('absensi_qr_stamp_image', data.stampImage);
    else localStorage.removeItem('absensi_qr_stamp_image');
    
    if (data.idCardConfig) localStorage.setItem('absensi_qr_idcard_config', data.idCardConfig);
    else localStorage.removeItem('absensi_qr_idcard_config');

    if (data.headmasterName) {
      localStorage.setItem('absensi_qr_headmaster_name', data.headmasterName);
      setHeadmasterName(data.headmasterName);
    }
    if (data.headmasterNip) {
      localStorage.setItem('absensi_qr_headmaster_nip', data.headmasterNip);
      setHeadmasterNip(data.headmasterNip);
    }
    if (data.academicYear) {
      localStorage.setItem('absensi_qr_academic_year', data.academicYear);
      setAcademicYear(data.academicYear);
    }

    if (data.teachers) {
      Object.entries(data.teachers).forEach(([className, val]: [string, any]) => {
        if (val.name) localStorage.setItem(`absensi_qr_teacher_name_${className}`, val.name);
        else localStorage.removeItem(`absensi_qr_teacher_name_${className}`);
        
        if (val.nip) localStorage.setItem(`absensi_qr_teacher_nip_${className}`, val.nip);
        else localStorage.removeItem(`absensi_qr_teacher_nip_${className}`);
      });
    }

    setConfirmRestoreData(null);
    setAlertMessage('Database dan semua pengaturan berhasil dipulihkan dari berkas cadangan!');
  };

  return (
    <div id="class-config-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left Column: School Profile Settings */}
      <form onSubmit={handleSaveConfig} className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
        <div className="space-y-5">
          <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            <div>
              <h4 className="text-base font-bold text-gray-900">Setelan Lembaga & Aturan Absensi</h4>
              <p className="text-xs text-gray-500">Konfigurasi nama sekolah dan rentang waktu absensi</p>
            </div>
          </div>

          {/* School Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <School className="h-3.5 w-3.5 text-gray-400" /> Nama Instansi / Sekolah
            </label>
            <input
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
            />
          </div>

          {/* Kepala Sekolah & NIP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span className="text-gray-400 font-bold">👤</span> Nama Kepala Sekolah
              </label>
              <input
                type="text"
                required
                value={headmasterName}
                onChange={(e) => setHeadmasterName(e.target.value)}
                placeholder="Drs. H. Suherman, M.Pd"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span className="text-gray-400 font-bold">🆔</span> NIP Kepala Sekolah
              </label>
              <input
                type="text"
                required
                value={headmasterNip}
                onChange={(e) => setHeadmasterNip(e.target.value)}
                placeholder="197403122005011002"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Tahun Ajaran */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-gray-400" /> Tahun Ajaran
            </label>
            <input
              type="text"
              required
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="TA. 2026/2027"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
            />
          </div>

          {/* School Logo */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Upload className="h-3.5 w-3.5 text-gray-400" /> Logo Instansi / Sekolah (Opsional)
            </label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative h-16 w-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  <button 
                    type="button" 
                    onClick={() => setLogoUrl('')}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-5 w-5 text-white" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <School className="h-6 w-6 opacity-30" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleLogoUpload}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 mt-1">Format: JPG, PNG, WEBP. Maks 500KB.</p>
              </div>
            </div>
          </div>

          {/* Check in limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" /> Jam Buka Absen
              </label>
              <input
                type="time"
                required
                value={checkInStart}
                onChange={(e) => setCheckInStart(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" /> Batas Toleransi Masuk
              </label>
              <input
                type="time"
                required
                value={checkInEnd}
                onChange={(e) => setCheckInEnd(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          <div className="p-3.5 bg-purple-50 text-purple-900 border border-purple-100 rounded-xl text-xs flex items-start gap-2">
            <Clock className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Ketentuan Terlambat:</strong>
              Setiap pemindaian QR Code siswa yang melebihi batas toleransi jam {checkInEnd} pagi akan tercatat di sistem dengan label toleransi khusus atau catatan terlambat pada laporan ekspor.
            </div>
          </div>

          {/* WhatsApp Config */}
          <div className="border-t border-gray-100 pt-5 mt-5">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              Pengaturan WhatsApp API
            </h4>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={waAutoSend}
                  onChange={(e) => setWaAutoSend(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-gray-800 block">Kirim Pesan Otomatis (Auto-Send)</span>
                  <span className="text-gray-500">Otomatis mengirimkan laporan via WA setelah berhasil absen</span>
                </div>
              </label>

              {waAutoSend && (
                <div className="pl-7 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Provider API</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="provider" value="fonnte" checked={waProvider === 'fonnte'} onChange={() => setWaProvider('fonnte')} className="text-purple-600 focus:ring-purple-500" />
                        <span className="text-sm font-semibold text-gray-700">Fonnte</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="provider" value="custom" checked={waProvider === 'custom'} onChange={() => setWaProvider('custom')} className="text-purple-600 focus:ring-purple-500" />
                        <span className="text-sm font-semibold text-gray-700">Custom API</span>
                      </label>
                    </div>
                  </div>

                  {waProvider === 'fonnte' ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        API Token Fonnte <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={waAutoSend && waProvider === 'fonnte'}
                        placeholder="Masukkan token dari m.fonnte.com"
                        value={waApiToken}
                        onChange={(e) => setWaApiToken(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:border-purple-500 transition-all"
                      />
                      <p className="mt-1.5 text-[10px] text-gray-500">
                        Daftar dan dapatkan token API gratis di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">fonnte.com</a>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          API URL <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          required={waAutoSend && waProvider === 'custom'}
                          placeholder="https://api.domainanda.com/send"
                          value={waApiUrl}
                          onChange={(e) => setWaApiUrl(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          Headers (JSON)
                        </label>
                        <textarea
                          placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                          value={waApiHeaders}
                          onChange={(e) => setWaApiHeaders(e.target.value)}
                          rows={2}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          Payload Template (JSON)
                        </label>
                        <textarea
                          placeholder='{"phone": "{{phone}}", "text": "{{message}}"}'
                          value={waApiPayload}
                          onChange={(e) => setWaApiPayload(e.target.value)}
                          rows={3}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 outline-none focus:border-purple-500 transition-all"
                        />
                        <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                          Gunakan <code>{`{{phone}}`}</code> untuk nomor HP, dan <code>{`{{message}}`}</code> untuk teks pesan. Metode HTTP yang digunakan adalah POST.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Saved Alert and button */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-6">
          <div className="flex items-center text-xs text-emerald-600 font-semibold gap-1">
            {isSavedAlert && (
              <>
                <Check className="h-4 w-4 bg-emerald-100 rounded-full p-0.5" />
                <span>Konfigurasi disimpan!</span>
              </>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Save className="h-4 w-4" /> Simpan Perubahan
          </button>
        </div>
      </form>

      {/* Right Column: Classroom Management & Backup */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Class presetter list */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="border-b border-gray-100 pb-3 flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-purple-600" />
            <div>
              <h4 className="text-base font-bold text-gray-900">Daftar Rombongan Belajar (Rombel)</h4>
              <p className="text-xs text-gray-500">Lihat dan tambahkan klasifikasi kelas baru</p>
            </div>
          </div>

          <form onSubmit={handleAddNewClass} className="flex gap-2 mb-4">
            <input 
              type="text"
              placeholder="Contoh: XII MIPA 2"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-purple-500 transition-all uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          </form>

          {/* List of active classes */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {uniqueClasses.map((className) => {
              const studentCount = students.filter(s => s.className === className).length;
              const isCustom = config.customClasses?.includes(className);
              const teacherName = config.teachers?.[className]?.name || localStorage.getItem(`absensi_qr_teacher_name_${className}`) || '';
              const teacherNip = config.teachers?.[className]?.nip || localStorage.getItem(`absensi_qr_teacher_nip_${className}`) || '';

              return (
                <div key={className} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-800 text-sm">{className}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full uppercase">
                        {studentCount} Siswa
                      </span>
                      {isCustom && (
                        <button
                          onClick={() => {
                            const studentCount = students.filter(s => s.className === className).length;
                            if (studentCount > 0) {
                              setAlertMessage(`Tidak dapat menghapus Rombel "${className}" karena masih memiliki ${studentCount} siswa terdaftar. Hapus atau pindahkan siswa terlebih dahulu.`);
                              return;
                            }
                            setClassToDelete(className);
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Hapus Rombel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-150/50 pt-2 text-gray-500">
                    <div>
                      {teacherName ? (
                        <div>
                          <div className="font-semibold text-gray-700">Wali: {teacherName}</div>
                          {teacherNip && <div className="text-[10px] text-gray-400">NIP. {teacherNip}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Belum ada Wali Kelas</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingClassTeacher(className);
                        setEditingTeacherName(teacherName);
                        setEditingTeacherNip(teacherNip);
                      }}
                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                    >
                      Atur Wali
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Database backup container */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-600" />
            <div>
              <h4 className="text-base font-bold text-gray-900">Pusat Pemeliharaan Data</h4>
              <p className="text-xs text-gray-500">Simpan salinan cadangan atau atur ulang database</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportBackup}
              className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="h-5 w-5 text-purple-600" />
              <span>Ekspor Cadangan</span>
            </button>
            
            <label className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer text-center">
              <Upload className="h-5 w-5 text-amber-600" />
              <span>Impor Cadangan</span>
              <input 
                type="file" 
                accept=".json"
                onChange={handleImportBackup}
                className="hidden" 
              />
            </label>
          </div>

          <button
            onClick={() => setConfirmResetData(true)}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl text-[11px] font-bold text-red-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="h-4 w-4" /> Atur Ulang Semua Database
          </button>
        </div>

      </div>

      {/* ALERT MODAL */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Informasi</h3>
              <p className="text-sm text-gray-500">{alertMessage}</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setAlertMessage(null)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm shadow-blue-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {confirmRestoreData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Pulihkan Cadangan?</h3>
              <p className="text-sm text-gray-500">
                Mengimpor berkas ini akan menimpa seluruh data siswa, riwayat kehadiran, dan pengaturan visual Anda saat ini. Lanjutkan?
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setConfirmRestoreData(null)}
                className="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={processRestore}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm shadow-amber-200"
              >
                Ya, Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {confirmResetData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Atur Ulang Database?</h3>
              <p className="text-sm text-gray-500">
                PERINGATAN: Tindakan ini akan menghapus semua siswa terdaftar dan mengosongkan seluruh riwayat absensi harian secara permanen. Lanjutkan?
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setConfirmResetData(false)}
                className="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onResetDatabase();
                  setConfirmResetData(false);
                  setAlertMessage('Database berhasil diatur ulang ke kondisi awal default.');
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm shadow-red-200"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Class Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-red-100 flex flex-col">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900">
                Hapus Rombel?
              </h3>
              <p className="text-sm text-gray-500">
                Apakah Anda yakin ingin menghapus rombongan belajar <strong>"{classToDelete}"</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setClassToDelete(null)}
                className="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  handleDeleteClass(classToDelete);
                  setClassToDelete(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm shadow-red-200"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT WALI KELAS MODAL */}
      {editingClassTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">👨‍🏫</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Atur Wali Kelas - {editingClassTeacher}</h3>
                <p className="text-xs text-gray-500">Tentukan nama dan NIP Wali Kelas untuk dicantumkan pada laporan.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nama Lengkap & Gelar</label>
                  <input
                    type="text"
                    value={editingTeacherName}
                    onChange={(e) => setEditingTeacherName(e.target.value)}
                    placeholder="Contoh: Budi Santoso, S.Pd"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">NIP Wali Kelas</label>
                  <input
                    type="text"
                    value={editingTeacherNip}
                    onChange={(e) => setEditingTeacherNip(e.target.value)}
                    placeholder="Contoh: 198205122008011003"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setEditingClassTeacher(null)}
                className="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const currentTeachers = config.teachers || {};
                  const updatedTeachers = {
                    ...currentTeachers,
                    [editingClassTeacher!]: {
                      name: editingTeacherName.trim(),
                      nip: editingTeacherNip.trim()
                    }
                  };
                  onUpdateConfig({
                    ...config,
                    teachers: updatedTeachers
                  });

                  if (editingTeacherName.trim()) {
                    localStorage.setItem(`absensi_qr_teacher_name_${editingClassTeacher}`, editingTeacherName.trim());
                  } else {
                    localStorage.removeItem(`absensi_qr_teacher_name_${editingClassTeacher}`);
                  }

                  if (editingTeacherNip.trim()) {
                    localStorage.setItem(`absensi_qr_teacher_nip_${editingClassTeacher}`, editingTeacherNip.trim());
                  } else {
                    localStorage.removeItem(`absensi_qr_teacher_nip_${editingClassTeacher}`);
                  }

                  setEditingClassTeacher(null);
                  setAlertMessage(`Wali Kelas untuk kelas ${editingClassTeacher} berhasil diperbarui!`);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm shadow-purple-200"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
