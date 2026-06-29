import React, { useState, useMemo, useEffect, FormEvent, ChangeEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Student } from '../types';
import { 
  UserPlus, Search, Edit2, Trash2, QrCode, 
  X, Download, Printer, FileSpreadsheet, FileUp, 
  Users, Check, ArrowRight, BookOpen, UserCheck, AlertCircle,
  CreditCard, ShieldCheck, Award, Layers
} from 'lucide-react';

// Simple and high-fidelity Code 39 barcode SVG generator for offline rendering
const CODE39_MAP: Record<string, string> = {
  '0': '101001101101',
  '1': '110100101011',
  '2': '101100101011',
  '3': '110110010101',
  '4': '101001101011',
  '5': '110100110101',
  '6': '101100110101',
  '7': '101001011011',
  '8': '110100101101',
  '9': '101100101101',
  'A': '110101001011',
  'B': '101101001011',
  'C': '110110100101',
  'D': '101011001011',
  'E': '110101100101',
  'F': '101101100101',
  'G': '101010011011',
  'H': '110101001101',
  'I': '101101001101',
  'J': '101011001101',
  'K': '110101010011',
  'L': '101101010011',
  'M': '110110101001',
  'N': '101011010011',
  'O': '110101101001',
  'P': '101101101001',
  'Q': '101010110011',
  'R': '110101011001',
  'S': '101101011001',
  'T': '101011011001',
  'U': '110010101011',
  'V': '100110101011',
  'W': '110011010101',
  'X': '100101101011',
  'Y': '110010110101',
  'Z': '100111010101',
  '-': '100101011011',
  '.': '110010101101',
  ' ': '100110101101',
  '*': '100101101101',
  '$': '100100100101',
  '/': '100100101001',
  '+': '100101001001',
  '%': '101001001001'
};

function Barcode({ value }: { value: string }) {
  const normalized = `*${value.toUpperCase()}*`;
  let binaryString = '';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP[' '];
    binaryString += pattern + '0';
  }

  const rects = [];
  for (let i = 0; i < binaryString.length; i++) {
    if (binaryString[i] === '1') {
      rects.push(
        <rect
          key={i}
          x={i}
          y={0}
          width={1.2}
          height={40}
          fill="currentColor"
        />
      );
    }
  }

  return (
    <svg 
      viewBox={`0 0 ${binaryString.length} 40`} 
      className="w-full h-full text-slate-800" 
      preserveAspectRatio="none"
    >
      {rects}
    </svg>
  );
}

interface StudentListProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBulkImport: (imported: Omit<Student, 'id'>[]) => void;
  activeClass: string;
  schoolName?: string;
  logoUrl?: string;
  customClasses?: string[];
}

export default function StudentList({ 
  students, 
  onAddStudent, 
  onEditStudent, 
  onDeleteStudent, 
  onBulkImport,
  activeClass,
  schoolName = 'SMA NEGERI 1 ABSENSI',
  logoUrl,
  customClasses = []
}: StudentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingQrStudent, setViewingQrStudent] = useState<Student | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [importError, setImportError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // ID Card State
  const [viewingIdCardStudent, setViewingIdCardStudent] = useState<Student | null>(null);
  const [isBulkIdCardModalOpen, setIsBulkIdCardModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [bulkPrintClass, setBulkPrintClass] = useState<string>('Semua Kelas');
  const [idCardTheme, setIdCardTheme] = useState<'navy' | 'crimson' | 'emerald' | 'gold'>('navy');
  const [idCardLayout, setIdCardLayout] = useState<'portrait' | 'landscape'>('portrait');
  const [includeBackCard, setIncludeBackCard] = useState(true);
  const [codeType, setCodeType] = useState<'qr' | 'barcode'>(() => (localStorage.getItem('absensi_code_type') as any) || 'qr');

  useEffect(() => {
    localStorage.setItem('absensi_code_type', codeType);
  }, [codeType]);

  // ID Card Customization Details
  const [headmasterName, setHeadmasterName] = useState(() => {
    return localStorage.getItem('absensi_qr_headmaster_name') || 'Drs. H. Suherman, M.Pd';
  });
  const [academicYear, setAcademicYear] = useState(() => {
    return localStorage.getItem('absensi_qr_academic_year') || 'TA. 2026/2027';
  });
  const [signatureImage, setSignatureImage] = useState<string | null>(() => {
    return localStorage.getItem('absensi_qr_signature_image') || null;
  });
  const [stampImage, setStampImage] = useState<string | null>(() => {
    return localStorage.getItem('absensi_qr_stamp_image') || null;
  });

  // Advanced ID Card Configuration
  const [idCardConfig, setIdCardConfig] = useState(() => {
    const defaultCfg = {
      bgFront: null as string | null,
      bgBack: null as string | null,
      widthMm: 54,
      heightMm: 86,
      visibility: {
        photo: true,
        nis: true,
        barcode: true,
        signature: true
      },
      codeType: 'qr' as 'qr' | 'barcode'
    };
    const saved = localStorage.getItem('absensi_qr_idcard_config');
    if (saved) {
      try {
        return { ...defaultCfg, ...JSON.parse(saved) };
      } catch (e) {
        return defaultCfg;
      }
    }
    return defaultCfg;
  });

  // Keep saved configuration persistent in localStorage
  useEffect(() => {
    localStorage.setItem('absensi_qr_headmaster_name', headmasterName);
  }, [headmasterName]);

  useEffect(() => {
    localStorage.setItem('absensi_qr_academic_year', academicYear);
  }, [academicYear]);

  useEffect(() => {
    localStorage.setItem('absensi_qr_idcard_config', JSON.stringify(idCardConfig));
  }, [idCardConfig]);

  useEffect(() => {
    if (signatureImage) {
      localStorage.setItem('absensi_qr_signature_image', signatureImage);
    } else {
      localStorage.removeItem('absensi_qr_signature_image');
    }
  }, [signatureImage]);

  useEffect(() => {
    if (stampImage) {
      localStorage.setItem('absensi_qr_stamp_image', stampImage);
    } else {
      localStorage.removeItem('absensi_qr_stamp_image');
    }
  }, [stampImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'signature' | 'stamp' | 'bgFront' | 'bgBack') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size limit (limit to 1.5MB to avoid localStorage quota issues)
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Ukuran gambar terlalu besar! Silakan gunakan gambar di bawah 1.5MB agar dapat disimpan.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === 'signature') {
        setSignatureImage(base64String);
      } else if (type === 'stamp') {
        setStampImage(base64String);
      } else if (type === 'bgFront') {
        setIdCardConfig(prev => ({ ...prev, bgFront: base64String }));
      } else if (type === 'bgBack') {
        setIdCardConfig(prev => ({ ...prev, bgBack: base64String }));
      }
    };
    reader.readAsDataURL(file);
  };

  const updateIdCardConfig = (key: keyof typeof idCardConfig, value: any) => {
    setIdCardConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleVisibility = (key: keyof typeof idCardConfig.visibility) => {
    setIdCardConfig(prev => ({
      ...prev,
      visibility: { ...prev.visibility, [key]: !prev.visibility[key] }
    }));
  };

  // Form Fields
  const [formData, setFormData] = useState({
    nis: '',
    name: '',
    gender: 'L' as 'L' | 'P',
    className: activeClass === 'Semua Kelas' ? 'XII MIPA 1' : activeClass,
    photo: '' as string | undefined,
    parentPhone: '' as string | undefined
  });

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesClass = activeClass === 'Semua Kelas' || student.className === activeClass;
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.nis.includes(searchQuery);
      return matchesClass && matchesSearch;
    });
  }, [students, activeClass, searchQuery]);

  const bulkTargetStudents = useMemo(() => {
    if (bulkPrintClass === 'Semua Kelas') return students;
    return students.filter(s => s.className === bulkPrintClass);
  }, [students, bulkPrintClass]);

  // Extract unique classes for form presets
  const availableClasses = useMemo(() => {
    const classes = new Set(students.map(s => s.className));
    customClasses.forEach(c => classes.add(c));
    if (classes.size === 0) {
      classes.add('XII MIPA 1');
      classes.add('XI IPS 2');
    }
    return Array.from(classes).sort();
  }, [students, customClasses]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.nis.trim() || !formData.name.trim()) return;

    // Check duplicate NIS (skip checked on current editing student)
    const isDuplicate = students.some(s => s.nis === formData.nis.trim() && s.id !== editingStudent?.id);
    if (isDuplicate) {
      alert(`Siswa dengan NIS ${formData.nis} sudah terdaftar! Gunakan nomor induk unik.`);
      return;
    }

    if (editingStudent) {
      onEditStudent({
        ...editingStudent,
        nis: formData.nis.trim(),
        name: formData.name.trim(),
        gender: formData.gender,
        className: formData.className,
        photo: formData.photo,
        parentPhone: formData.parentPhone?.trim() || undefined
      });
    } else {
      onAddStudent({
        nis: formData.nis.trim(),
        name: formData.name.trim(),
        gender: formData.gender,
        className: formData.className,
        photo: formData.photo,
        parentPhone: formData.parentPhone?.trim() || undefined
      });
    }

    // Reset Form
    setFormData({
      nis: '',
      name: '',
      gender: 'L',
      className: activeClass === 'Semua Kelas' ? 'XII MIPA 1' : activeClass,
      photo: '',
      parentPhone: ''
    });
    setEditingStudent(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      nis: student.nis,
      name: student.name,
      gender: student.gender,
      className: student.className,
      photo: student.photo || '',
      parentPhone: student.parentPhone || ''
    });
    setIsFormOpen(true);
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    const headers = 'NIS,Nama Lengkap,Jenis Kelamin (L/P),Kelas,Link Foto,No WA Ortu\n';
    const rows = filteredStudents.map(s => 
      `"${s.nis}","${s.name}","${s.gender}","${s.className}","${s.photo || ''}","${s.parentPhone || ''}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daftar_Siswa_${activeClass.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download CSV template helper
  const handleDownloadTemplate = () => {
    const headers = 'NIS,Nama Lengkap,Jenis Kelamin (L/P),Kelas,Link Foto (Opsional),No WA Ortu (Opsional)\n';
    const sampleRows = [
      '21001,Ahmad Fauzi,L,XII MIPA 1,https://img.co/1.jpg,081234567890',
      '21002,Citra Lestari,P,XII MIPA 1,,081234567891',
      '21003,Budi Setiawan,L,XII MIPA 2,,',
      '21004,Dewi Sartika,P,XII MIPA 2,,'
    ].join('\n');

    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'format_siswa_absensi.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setImportError('Berkas harus berupa file format CSV (.csv)');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setCsvRawText(text);
        setImportError('');
      }
    };
    reader.onerror = () => {
      setImportError('Gagal membaca file CSV.');
    };
    reader.readAsText(file);
  };

  // CSV Import handler
  const handleImportSubmit = (e: FormEvent) => {
    e.preventDefault();
    setImportError('');
    
    if (!csvRawText.trim()) {
      setImportError('Data CSV tidak boleh kosong. Silakan unggah berkas atau tempel data terlebih dahulu.');
      return;
    }

    try {
      const lines = csvRawText.trim().split(/\r?\n/);
      const importedList: Omit<Student, 'id'>[] = [];
      let skippedCount = 0;
      
      lines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines

        // Skip header if it exists
        if (index === 0 && (line.toLowerCase().includes('nis') || line.toLowerCase().includes('nama'))) {
          return;
        }

        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(',') ? ',' : null;
        
        // Fallback to comma if no delimiter found but it's a single column (will fail later if it's truly bad)
        const cols = line.split(delimiter || ',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        
        if (cols.length < 4) {
          skippedCount++;
          return; // Skip invalid rows instead of crashing entirely, we'll notify them later
        }

        const nis = cols[0];
        const name = cols[1];
        const genderRaw = cols[2].toUpperCase();
        const gender = (genderRaw === 'LAKI-LAKI' || genderRaw === 'L' || genderRaw === 'M' || genderRaw === 'MALE' || genderRaw === 'PUTRA') ? 'L' : 'P';
        const className = cols[3];
        const photo = cols[4] || ''; // Optional 5th column: Photo Link URL
        const parentPhone = cols[5] || ''; // Optional 6th column: Parent Phone Number

        if (!nis || !name || !className) {
          skippedCount++;
          return; 
        }

        importedList.push({ nis, name, gender, className, photo, parentPhone });
      });

      if (importedList.length === 0) {
        throw new Error('Tidak ada data siswa valid yang terbaca. Pastikan format kolom sesuai: NIS, Nama, Gender, Kelas.');
      }

      onBulkImport(importedList);
      setCsvRawText('');
      setIsImportOpen(false);
      
      if (skippedCount > 0) {
        alert(`Berhasil mengimpor ${importedList.length} siswa. Terdapat ${skippedCount} baris yang diabaikan karena format tidak lengkap.`);
      } else {
        alert(`Berhasil mengimpor ${importedList.length} siswa secara massal!`);
      }
    } catch (err: any) {
      setImportError(err.message || 'Gagal memproses data CSV.');
    }
  };

  // Print bulk QR codes
  const handlePrintAllQRs = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cardsHtml = filteredStudents.map(s => {
      // Inline rendering of simple QR badge card
      return `
        <div class="qr-card">
          <h3>${s.name}</h3>
          <p class="meta">NIS: ${s.nis} | Kelas: ${s.className}</p>
          <div class="qr-placeholder" id="qr-${s.id}"></div>
          <p class="footer">PINDAI UNTUK ABSEN</p>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Kartu Absen QR - ${activeClass}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; background: white; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
            .qr-card { border: 2px solid #E5E7EB; border-radius: 12px; padding: 15px; text-align: center; page-break-inside: avoid; }
            h3 { margin: 0 0 5px 0; font-size: 14px; color: #111827; }
            .meta { margin: 0 0 15px 0; font-size: 11px; color: #6B7280; font-family: monospace; }
            .qr-placeholder { display: flex; justify-content: center; margin: 10px 0; }
            .footer { margin: 10px 0 0 0; font-size: 9px; font-weight: bold; color: #7C3AED; letter-spacing: 1px; }
            @media print {
              body { padding: 0; }
              .qr-card { border: 1px solid #ccc; }
            }
          </style>
        </head>
        <body>
          <h2 style="text-align: center; color: #4B5563; font-size: 18px;">Kartu QR Absensi Siswa - ${activeClass}</h2>
          <div class="grid">
            ${cardsHtml}
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script>
            window.onload = function() {
              const students = ${JSON.stringify(filteredStudents)};
              const codeType = "${codeType}";
              students.forEach(s => {
                const container = document.getElementById('qr-' + s.id);
                if(container) {
                  if(codeType === 'barcode') {
                    const canvas = document.createElement('canvas');
                    JsBarcode(canvas, s.nis, {
                      format: "CODE128",
                      width: 1.5,
                      height: 50,
                      displayValue: false,
                      margin: 0
                    });
                    container.appendChild(canvas);
                  } else {
                    const qr = qrcode(0, 'M');
                    qr.addData(s.nis);
                    qr.make();
                    container.innerHTML = qr.createSvgTag(6, 1);
                  }
                }
              });
              setTimeout(() => {
                window.print();
                window.close();
              }, 400);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print high-fidelity student ID Cards
  const handlePrintIDCardsAction = (targetStudents: Student[], classNameTitle: string = 'Semua') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cardsHtml = targetStudents.map(s => {
      const avatarMaleSvg = `
        <svg viewBox="0 0 100 100" class="avatar-svg">
          <rect width="100%" height="100%" fill="#eff6ff" rx="12"/>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#dbeafe" stroke-width="1.5" stroke-dasharray="2 2"/>
          <circle cx="50" cy="38" r="16" fill="#93c5fd"/>
          <path d="M22 80 C 22 58, 35 55, 50 55 C 65 55, 78 58, 78 80 Z" fill="#3b82f6"/>
        </svg>
      `;

      const avatarFemaleSvg = `
        <svg viewBox="0 0 100 100" class="avatar-svg">
          <rect width="100%" height="100%" fill="#fff1f2" rx="12"/>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#ffe4e6" stroke-width="1.5" stroke-dasharray="2 2"/>
          <circle cx="50" cy="38" r="16" fill="#fda4af"/>
          <path d="M24 80 C 24 58, 36 55, 50 55 C 64 55, 76 58, 76 80 Z" fill="#f43f5e"/>
        </svg>
      `;

      const avatarSvg = idCardConfig.visibility.photo ? (
        s.photo 
        ? `<img src="${s.photo}" class="avatar-image" alt="Foto ${s.name}" />` 
        : (s.gender === 'L' ? avatarMaleSvg : avatarFemaleSvg)
      ) : '';

      // Select theme color hexes
      let strokeColor = '#1e3a8a'; // Signature stroke color
      if (idCardTheme === 'crimson') strokeColor = '#be123c';
      if (idCardTheme === 'emerald') strokeColor = '#047857';
      if (idCardTheme === 'gold') strokeColor = '#b45309';

      const signatureSvg = idCardConfig.visibility.signature ? (
        signatureImage ? `
        <image href="${signatureImage}" x="15" y="2" width="70" height="36" preserveAspectRatio="xMidYMid meet" style="opacity: 0.95;"/>
      ` : `
        <svg viewBox="0 0 100 40" class="sig-path" style="width:70px; height:28px; opacity: 0.85;">
          <path d="M10 25 C 18 12, 28 8, 38 18 C 45 25, 42 6, 52 14 C 60 22, 68 25, 82 18 C 88 16, 76 32, 92 25" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `) : '';

      const stampSvg = idCardConfig.visibility.signature ? (
        stampImage ? `
        <image href="${stampImage}" x="30" y="5" width="55" height="55" preserveAspectRatio="xMidYMid meet" class="stamp-svg" style="width: 52px; height: 52px; position: absolute; left: 50%; transform: translateX(-35%) rotate(-15deg); bottom: -6px; opacity: 0.65; pointer-events: none;"/>
      ` : `
        <svg viewBox="0 0 100 100" class="stamp-svg" style="width: 52px; height: 52px; position: absolute; left: 50%; transform: translateX(-35%) rotate(-15deg); bottom: -6px; opacity: 0.28; pointer-events: none; color: ${strokeColor};">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 1.5"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="0.8"/>
          <text x="50" y="24" text-anchor="middle" font-size="5" font-weight="900" fill="currentColor" letter-spacing="1">ABSENSI DIGITAL</text>
          <text x="50" y="81" text-anchor="middle" font-size="5" font-weight="900" fill="currentColor" letter-spacing="1">KARTU RESMI</text>
          <path d="M 32 50 L 68 50 M 50 32 L 50 68" stroke="currentColor" stroke-width="0.8"/>
          <polygon points="50,42 52,48 58,49 53,53 54,59 50,56 46,59 47,53 42,49 48,48" fill="currentColor"/>
        </svg>
      `) : '';

      const bgFrontHtml = idCardConfig.bgFront ? `
        <img src="${idCardConfig.bgFront}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; opacity: 0.25;" />
      ` : '';

      const bgBackHtml = idCardConfig.bgBack ? `
        <img src="${idCardConfig.bgBack}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; opacity: 0.15;" />
      ` : '';

      const nisHtml = idCardConfig.visibility.nis ? `<div class="student-nis-display">NIS: ${s.nis}</div>` : '';
      const barcodeHtmlPortrait = idCardConfig.visibility.barcode ? `
        <!-- Linear Barcode Container -->
        <div class="barcode-container" style="z-index: 10;">
          <div class="barcode-graphic" id="barcode-${s.id}"></div>
          <div class="barcode-text">* ${s.nis || s.id} *</div>
        </div>
      ` : '';

      const nisHtmlLandscape = idCardConfig.visibility.nis ? `<div class="student-nis-display" style="font-size: 7px;">NIS: ${s.nis}</div>` : '';
      const barcodeHtmlLandscape = idCardConfig.visibility.barcode ? `
        <div class="landscape-barcode-box" style="z-index: 10;">
          <div class="barcode-graphic" id="barcode-${s.id}" style="transform: scale(0.65); transform-origin: center;"></div>
          <div class="barcode-text" style="font-size: 5px;">* ${s.nis || s.id} *</div>
        </div>
      ` : '';

      if (idCardLayout === 'portrait') {
        return `
          <div class="card-pair-wrapper">
            <!-- FRONT CARD -->
            <div class="id-card id-card-portrait front">
              ${bgFrontHtml}
              <div class="card-header-band" style="z-index: 10;">
                <div class="crest-container">
                  ${logoUrl ? `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:contain;"/>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crest-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`}
                </div>
                <div class="header-text-container">
                  <div class="school-name-text">${schoolName}</div>
                  <div class="document-title">KARTU IDENTITAS SISWA</div>
                </div>
              </div>
              
              <div class="national-strip" style="z-index: 10;"></div>
              
              <div class="card-body-container" style="z-index: 10;">
                <div class="avatar-frame">
                  ${avatarSvg}
                </div>
                
                <div class="student-name-display">${s.name}</div>
                ${nisHtml}
                
                <div class="info-table">
                  <div class="info-row">
                    <span class="info-label">KELAS</span>
                    <span class="info-value">${s.className}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">GENDER</span>
                    <span class="info-value">${s.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">STATUS</span>
                    <span class="info-value status-active">SISWA AKTIF</span>
                  </div>
                </div>

                ${barcodeHtmlPortrait}
              </div>
              
              <div class="card-footer-band" style="z-index: 10;">
                <div class="authorized-signature-section">
                  <div class="validity-sticker">${academicYear}</div>
                  <div class="signature-title-text">Kepala Sekolah,</div>
                  <div class="signature-display">
                    ${signatureSvg}
                    ${stampSvg}
                  </div>
                  <div class="signer-name-text">${idCardConfig.visibility.signature ? headmasterName : ''}</div>
                </div>
              </div>
            </div>

            ${includeBackCard ? `
              <!-- BACK CARD -->
              <div class="id-card id-card-portrait back">
                ${bgBackHtml}
                <div class="back-banner" style="z-index: 10;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="back-logo-icon"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v19a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1-2.5-2.5z"/></svg>
                  <span>KETENTUAN KARTU SISWA</span>
                </div>
                
                <div class="rules-list-container" style="z-index: 10;">
                  <div class="rule-item">
                    <span class="rule-num">1</span>
                    <p class="rule-text">Kartu ini adalah tanda pengenal resmi siswa di lingkungan <strong>${schoolName}</strong>.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">2</span>
                    <p class="rule-text">Wajib dibawa setiap hari sekolah dan digunakan untuk melakukan pencatatan kehadiran absensi digital di mesin scanner.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">3</span>
                    <p class="rule-text">Dilarang merusak, memodifikasi, meniru, mencoret, atau memindahtangankan kartu ini kepada siswa lain.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">4</span>
                    <p class="rule-text">Apabila kartu hilang atau mengalami kerusakan fatal, segera hubungi Tata Usaha untuk pencetakan ulang.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">5</span>
                    <p class="rule-text">Jika menemukan kartu ini tercecer, mohon kembalikan langsung ke alamat kantor sekolah atau guru piket.</p>
                  </div>
                </div>

                <div class="back-footer-credit" style="z-index: 10;">
                  <div class="credit-barcode"></div>
                  <div class="credit-text-label">SISTEM INTEGRASI KODE QR ABSENSI SEKOLAH</div>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        // LANDSCAPE CARD
        const barcodeHtmlLandscape2 = idCardConfig.visibility.barcode ? `
                  <div class="barcode-container landscape-barcode-container" style="z-index: 10;">
                    <div class="barcode-graphic" id="barcode-${s.id}"></div>
                    <div class="barcode-text" style="font-size: 3.5px; letter-spacing: 0.04cm;">* ${s.nis || s.id} *</div>
                  </div>
        ` : '';
        const nisHtmlLandscape2 = idCardConfig.visibility.nis ? `<div class="landscape-nis-text">NIS: ${s.nis}</div>` : '';

        return `
          <div class="card-pair-wrapper landscape-wrapper">
            <!-- FRONT CARD LANDSCAPE -->
            <div class="id-card id-card-landscape front">
              ${bgFrontHtml}
              <div class="landscape-header-band" style="z-index: 10;">
                <div class="landscape-crest">
                  ${logoUrl ? `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:contain;"/>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crest-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`}
                </div>
                <div class="landscape-header-text">
                  <div class="school-name-text">${schoolName}</div>
                  <div class="document-title">KARTU TANDA PELAJAR / SISWA</div>
                </div>
                <div class="validity-sticker-landscape">TA. ${academicYear}</div>
              </div>
              
              <div class="national-strip" style="z-index: 10;"></div>
              
              <div class="landscape-body-split" style="z-index: 10;">
                <!-- Left panel: Avatar & Barcode -->
                <div class="left-panel">
                  <div class="avatar-frame landscape-avatar">
                    ${avatarSvg}
                  </div>
                  ${barcodeHtmlLandscape2}
                </div>
                
                <!-- Right panel: Student Info & Sign -->
                <div class="right-panel">
                  <div class="landscape-name-text">${s.name}</div>
                  ${nisHtmlLandscape2}
                  
                  <div class="landscape-info-grid">
                    <div class="l-info-item">
                      <span class="l-info-lbl">KELAS:</span>
                      <span class="l-info-val">${s.className}</span>
                    </div>
                    <div class="l-info-item">
                      <span class="l-info-lbl">GENDER:</span>
                      <span class="l-info-val">${s.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}</span>
                    </div>
                    <div class="l-info-item">
                      <span class="l-info-lbl">STATUS:</span>
                      <span class="l-info-val text-green">SISWA AKTIF</span>
                    </div>
                  </div>
                  
                  <div class="landscape-signature-section">
                    <div class="signature-title-text">Kepala Sekolah,</div>
                    <div class="signature-display">
                      ${signatureSvg}
                      ${stampSvg}
                    </div>
                    <div class="signer-name-text">${idCardConfig.visibility.signature ? headmasterName : ''}</div>
                  </div>
                </div>
              </div>
            </div>

            ${includeBackCard ? `
              <!-- BACK CARD LANDSCAPE -->
              <div class="id-card id-card-landscape back">
                <div class="back-banner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="back-logo-icon"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v19a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1-2.5-2.5z"/></svg>
                  <span>KETENTUAN PEMAKAIAN KARTU PELAJAR</span>
                </div>
                
                <div class="rules-list-container landscape-rules">
                  <div class="rule-item">
                    <span class="rule-num">1</span>
                    <p class="rule-text">Kartu ini wajib dibawa di lingkungan sekolah dan saat melakukan perekaman absensi mandiri.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">2</span>
                    <p class="rule-text">Dilarang keras menyalin, menempel stiker di atas barcode/QR, merusak, atau menyalahgunakan kartu ini.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">3</span>
                    <p class="rule-text">Jika kartu rusak atau hilang, siswa wajib mengajukan pembuatan kartu baru melalui Admin Sekolah.</p>
                  </div>
                  <div class="rule-item">
                    <span class="rule-num">4</span>
                    <p class="rule-text">Jika menemukan kartu pelajar ini di jalan, mohon segera hubungi panitia sekolah atau Tata Usaha.</p>
                  </div>
                </div>

                <div class="back-footer-credit landscape-back-foot">
                  <div class="credit-barcode"></div>
                  <div class="credit-text-label">SISTEM INTEGRASI ABSENSI DIGITAL QR INDONESIA</div>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak ID Card Pelajar - ${activeClass}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            :root {
              --primary: #1e3a8a;
              --primary-rgb: 30, 58, 138;
              --secondary: #3b82f6;
              --accent: #06b6d4;
              --gradient: linear-gradient(135deg, #0d1b3e 0%, #1e3a8a 100%);
            }
            
            .theme-navy {
              --primary: #1e3a8a;
              --primary-rgb: 30, 58, 138;
              --secondary: #3b82f6;
              --accent: #06b6d4;
              --gradient: linear-gradient(135deg, #0d1b3e 0%, #1e3a8a 100%);
            }
            .theme-crimson {
              --primary: #881337;
              --primary-rgb: 136, 19, 55;
              --secondary: #e11d48;
              --accent: #f43f5e;
              --gradient: linear-gradient(135deg, #2a0510 0%, #881337 100%);
            }
            .theme-emerald {
              --primary: #064e3b;
              --primary-rgb: 6, 78, 59;
              --secondary: #10b981;
              --accent: #14b8a6;
              --gradient: linear-gradient(135deg, #011d15 0%, #064e3b 100%);
            }
            .theme-gold {
              --primary: #451a03;
              --primary-rgb: 69, 26, 3;
              --secondary: #d97706;
              --accent: #f59e0b;
              --gradient: linear-gradient(135deg, #111115 0%, #451a03 100%);
            }

            body {
              font-family: 'Inter', sans-serif;
              background-color: #f3f4f6;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .print-controls {
              background-color: white;
              padding: 15px 30px;
              border-radius: 12px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.05);
              margin-bottom: 25px;
              display: flex;
              align-items: center;
              gap: 15px;
              border: 1px solid #e5e7eb;
            }

            .print-btn {
              background-color: #7c3aed;
              color: white;
              border: none;
              padding: 8px 18px;
              font-weight: bold;
              font-size: 13px;
              border-radius: 8px;
              cursor: pointer;
              transition: all 150ms;
            }
            .print-btn:hover {
              background-color: #6d28d9;
            }
            
            .close-btn {
              background-color: #e5e7eb;
              color: #4b5563;
              border: none;
              padding: 8px 18px;
              font-weight: bold;
              font-size: 13px;
              border-radius: 8px;
              cursor: pointer;
            }

            .cards-container {
              display: flex;
              flex-direction: column;
              gap: 30px;
              align-items: center;
              width: 100%;
            }

            .card-pair-wrapper {
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 15px;
              background-color: white;
              padding: 15px;
              border-radius: 16px;
              border: 1px dashed #d1d5db;
              page-break-inside: avoid;
            }

            /* ID CARD GENERAL DEFINITIONS */
            .id-card {
              box-sizing: border-box;
              background-color: white;
              border: 1.5px solid #d1d5db;
              position: relative;
              overflow: hidden;
              box-shadow: 0 5px 15px rgba(0,0,0,0.06);
              display: flex;
              flex-direction: column;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Portrait Sizing */
            .id-card-portrait {
              width: ${idCardConfig.widthMm}mm;
              height: ${idCardConfig.heightMm}mm;
              border-radius: 0.35cm;
            }

            /* Landscape Sizing */
            .id-card-landscape {
              width: ${idCardConfig.heightMm}mm;
              height: ${idCardConfig.widthMm}mm;
              border-radius: 0.35cm;
            }

            /* PORTRAIT FRONT CARD */
            .id-card-portrait.front {
              /* full borders and rounded corners */
            }
            .id-card-portrait.back {
              /* full borders and rounded corners */
            }

            /* LANDSCAPE FRONT & BACK CORNERS */
            .id-card-landscape.front {
              /* full borders and rounded corners */
            }
            .id-card-landscape.back {
              /* full borders and rounded corners */
            }

            /* PORTRAIT STYLING */
            .card-header-band {
              background: var(--gradient);
              color: white;
              padding: 0.25cm 0.2cm;
              display: flex;
              align-items: center;
              gap: 0.15cm;
              height: 1.1cm;
              box-sizing: border-box;
            }

            .crest-container {
              background-color: rgba(255, 255, 255, 0.15);
              border-radius: 50%;
              width: 0.65cm;
              height: 0.65cm;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .crest-icon {
              width: 0.4cm;
              height: 0.4cm;
              color: #fbbf24;
            }

            .header-text-container {
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
            }

            .school-name-text {
              font-size: 6px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
            }

            .document-title {
              font-size: 5px;
              font-weight: 500;
              color: #fbbf24;
              letter-spacing: 0.3px;
              margin-top: 1px;
            }

            .national-strip {
              height: 2px;
              background: linear-gradient(to right, #ef4444 50%, #ffffff 50%);
              width: 100%;
            }

            .card-body-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 0.25cm 0.2cm 0.1cm 0.2cm;
              box-sizing: border-box;
              background-image: radial-gradient(circle at 10% 20%, rgba(var(--primary-rgb), 0.02) 0%, transparent 40%),
                                radial-gradient(circle at 90% 80%, rgba(var(--primary-rgb), 0.02) 0%, transparent 40%);
            }

            .avatar-frame {
              width: 1.6cm;
              height: 1.6cm;
              border-radius: 0.2cm;
              padding: 1.5px;
              border: 1.5px solid var(--primary);
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              background-color: white;
              overflow: hidden;
              box-sizing: border-box;
              margin-bottom: 0.1cm;
            }

            .avatar-svg {
              width: 100%;
              height: 100%;
              display: block;
            }

            .avatar-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              border-radius: 0.15cm;
            }

            .student-name-display {
              font-size: 8.5px;
              font-weight: 800;
              color: #111827;
              text-align: center;
              line-height: 1.1;
              text-transform: uppercase;
              max-width: 100%;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
              margin-bottom: 1px;
            }

            .student-nis-display {
              font-size: 6px;
              font-weight: 600;
              color: #6b7280;
              font-family: monospace;
              margin-bottom: 0.15cm;
            }

            .info-table {
              width: 100%;
              background-color: #f9fafb;
              border-radius: 0.15cm;
              padding: 0.1cm 0.15cm;
              border: 0.5px solid #e5e7eb;
              box-sizing: border-box;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              border-bottom: 0.5px solid #f3f4f6;
            }
            .info-row:last-child {
              border-bottom: none;
            }

            .info-label {
              font-size: 5px;
              font-weight: 700;
              color: #9ca3af;
            }

            .info-value {
              font-size: 5.5px;
              font-weight: 700;
              color: #374151;
            }
            
            .status-active {
              color: #10b981;
              font-weight: 800;
            }

            .card-footer-band {
              height: 1.8cm;
              border-top: 1px solid #e5e7eb;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 0.1cm 0.2cm;
              box-sizing: border-box;
              background-color: #fafafa;
              position: relative;
            }

            .barcode-container {
              width: 100%;
              background-color: white;
              border: 0.5px solid #cbd5e1;
              border-radius: 0.2cm;
              padding: 0.12cm 0.15cm;
              box-sizing: border-box;
              margin-top: 0.15cm;
              margin-bottom: 0.05cm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }

            .barcode-graphic {
              width: 100%;
              height: 0.65cm;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .barcode-text {
              font-family: monospace;
              font-size: 4.5px;
              font-weight: 800;
              color: #64748b;
              margin-top: 2px;
              letter-spacing: 0.08cm;
              text-transform: uppercase;
            }

            .authorized-signature-section {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              height: 100%;
              justify-content: space-between;
              box-sizing: border-box;
              position: relative;
            }

            .validity-sticker {
              background-color: #10b981;
              color: white;
              font-size: 4px;
              font-weight: 900;
              padding: 1px 4px;
              border-radius: 2px;
              position: absolute;
              top: 0;
              right: 0;
              margin-bottom: 0;
            }

            .signature-title-text {
              font-size: 4.5px;
              font-weight: 600;
              color: #4b5563;
              margin-top: 1px;
              margin-bottom: 1px;
            }

            .signature-display {
              width: 100%;
              height: 0.7cm;
              position: relative;
              display: flex;
              justify-content: center;
              align-items: center;
            }

            .sig-path {
              z-index: 10;
              position: relative;
            }

            .signer-name-text {
              font-size: 5px;
              font-weight: 800;
              color: #111827;
              text-decoration: underline;
              text-align: center;
            }

            /* PORTRAIT BACK CARD STYLING */
            .id-card-portrait.back {
              background-color: white;
              display: flex;
              flex-direction: column;
              padding: 0.3cm 0.2cm;
              box-sizing: border-box;
            }

            .back-banner {
              background: var(--gradient);
              color: white;
              padding: 0.15cm;
              border-radius: 0.15cm;
              font-size: 6px;
              font-weight: 800;
              display: flex;
              align-items: center;
              gap: 4px;
              text-transform: uppercase;
              letter-spacing: 0.2px;
              justify-content: center;
            }
            
            .back-logo-icon {
              width: 8px;
              height: 8px;
              color: #fbbf24;
            }

            .rules-list-container {
              margin-top: 0.25cm;
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 0.1cm;
            }

            .rule-item {
              display: flex;
              gap: 4px;
              align-items: flex-start;
            }

            .rule-num {
              background-color: var(--primary);
              color: white;
              font-size: 4px;
              font-weight: 900;
              width: 7px;
              height: 7px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              margin-top: 1px;
            }

            .rule-text {
              margin: 0;
              font-size: 4.8px;
              color: #4b5563;
              line-height: 1.35;
              text-align: left;
            }

            .back-footer-credit {
              border-top: 0.5px solid #e5e7eb;
              padding-top: 0.15cm;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 3px;
            }

            .credit-barcode {
              width: 100%;
              height: 0.45cm;
              background: linear-gradient(to right, 
                #111 0%, #111 2%, transparent 2%, transparent 4%,
                #111 4%, #111 8%, transparent 8%, transparent 9%,
                #111 9%, #111 10%, transparent 10%, transparent 12%,
                #111 12%, #111 17%, transparent 17%, transparent 19%,
                #111 19%, #111 20%, transparent 20%, transparent 24%,
                #111 24%, #111 25%, transparent 25%, transparent 28%,
                #111 28%, #111 34%, transparent 34%, transparent 37%,
                #111 37%, #111 38%, transparent 38%, transparent 42%,
                #111 42%, #111 47%, transparent 47%, transparent 48%,
                #111 48%, #111 50%, transparent 50%, transparent 53%,
                #111 53%, #111 58%, transparent 58%, transparent 60%,
                #111 60%, #111 61%, transparent 61%, transparent 65%,
                #111 65%, #111 71%, transparent 71%, transparent 74%,
                #111 74%, #111 75%, transparent 75%, transparent 79%,
                #111 79%, #111 80%, transparent 80%, transparent 84%,
                #111 84%, #111 89%, transparent 89%, transparent 91%,
                #111 91%, #111 92%, transparent 92%, transparent 95%,
                #111 95%, #111 100%);
              opacity: 0.75;
            }

            .credit-text-label {
              font-size: 3.8px;
              font-weight: 700;
              color: #9ca3af;
              letter-spacing: 0.2px;
            }

            /* LANDSCAPE STYLING */
            .landscape-header-band {
              background: var(--gradient);
              color: white;
              padding: 0.15cm 0.25cm;
              display: flex;
              align-items: center;
              gap: 0.2cm;
              height: 1.0cm;
              box-sizing: border-box;
              position: relative;
            }

            .landscape-crest {
              background-color: rgba(255, 255, 255, 0.15);
              border-radius: 50%;
              width: 0.7cm;
              height: 0.7cm;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .landscape-header-text {
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
            }

            .validity-sticker-landscape {
              position: absolute;
              right: 0.25cm;
              top: 50%;
              transform: translateY(-50%);
              background-color: #10b981;
              color: white;
              font-size: 4px;
              font-weight: 900;
              padding: 1px 4px;
              border-radius: 2px;
            }

            .landscape-body-split {
              flex: 1;
              display: flex;
              flex-direction: row;
              padding: 0.2cm 0.25cm;
              box-sizing: border-box;
              background-image: radial-gradient(circle at 10% 20%, rgba(var(--primary-rgb), 0.02) 0%, transparent 40%);
            }

            .left-panel {
              width: 1.9cm;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.15cm;
              border-right: 0.5px solid #e5e7eb;
              padding-right: 0.15cm;
              box-sizing: border-box;
              justify-content: center;
            }

            .landscape-avatar {
              width: 1.4cm;
              height: 1.4cm;
              margin-bottom: 0;
            }

            .landscape-barcode-container {
              width: 1.75cm;
              margin-top: 0.1cm;
              padding: 0.08cm 0.1cm;
            }
            .landscape-barcode-container .barcode-graphic {
              height: 0.5cm;
            }

            .right-panel {
              flex: 1;
              padding-left: 0.25cm;
              display: flex;
              flex-direction: column;
              box-sizing: border-box;
              position: relative;
              justify-content: space-between;
            }

            .landscape-name-text {
              font-size: 9px;
              font-weight: 900;
              color: #111827;
              text-transform: uppercase;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
              margin-bottom: 1px;
              line-height: 1.1;
            }

            .landscape-nis-text {
              font-size: 5.5px;
              font-weight: 600;
              color: #6b7280;
              font-family: monospace;
              margin-bottom: 0.15cm;
            }

            .landscape-info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3px;
              background-color: #f9fafb;
              border-radius: 0.12cm;
              padding: 0.1cm 0.15cm;
              border: 0.5px solid #e5e7eb;
              box-sizing: border-box;
              margin-bottom: 0.1cm;
            }

            .l-info-item {
              display: flex;
              flex-direction: row;
              gap: 3px;
            }

            .l-info-lbl {
              font-size: 4.8px;
              font-weight: 700;
              color: #9ca3af;
            }

            .l-info-val {
              font-size: 4.8px;
              font-weight: 700;
              color: #374151;
            }
            .l-info-val.text-green {
              color: #10b981;
            }

            .landscape-signature-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
            }

            .landscape-signature-section .signature-display {
              height: 0.55cm;
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
            }

            /* LANDSCAPE BACK CARD */
            .id-card-landscape.back {
              background-color: white;
              padding: 0.25cm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }

            .landscape-rules {
              margin-top: 0.15cm;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0.15cm 0.25cm;
            }

            .landscape-back-foot {
              margin-top: 0.1cm;
              padding-top: 0.1cm;
            }

            /* CUT LINES */
            .cut-line-portrait {
              width: 15px;
              height: 8.5cm;
              border-left: 1px dashed #d1d5db;
              border-right: 1px dashed #d1d5db;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #fcfcfc;
              box-sizing: border-box;
              position: relative;
            }
            .cut-line-portrait span {
              transform: rotate(90deg);
              font-size: 5px;
              color: #9ca3af;
              font-weight: bold;
              white-space: nowrap;
              letter-spacing: 1px;
            }

            .cut-line-landscape {
              width: 15px;
              height: 5.4cm;
              border-left: 1px dashed #d1d5db;
              border-right: 1px dashed #d1d5db;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #fcfcfc;
              box-sizing: border-box;
              position: relative;
            }
            .cut-line-landscape span {
              transform: rotate(90deg);
              font-size: 5px;
              color: #9ca3af;
              font-weight: bold;
              white-space: nowrap;
              letter-spacing: 1px;
            }

            @media print {
              body {
                background-color: white;
                padding: 0;
              }
              .print-controls {
                display: none !important;
              }
              .card-pair-wrapper {
                border: none !important;
                padding: 0 !important;
                margin-bottom: 0.8cm;
                box-shadow: none !important;
              }
              .id-card {
                box-shadow: none !important;
                border: 1px solid #111111 !important;
              }
              .cut-line-portrait, .cut-line-landscape {
                background-color: transparent !important;
              }
            }
          </style>
        </head>
        <body class="theme-${idCardTheme}">
          
          <div class="print-controls">
            <span style="font-size: 13px; font-weight: bold; color: #1f2937;">Pratinjau Cetak ID Card (${targetStudents.length} Siswa, Kelas: ${classNameTitle})</span>
            <div style="display: flex; gap: 8px;">
              <button class="print-btn" onclick="window.print()">Cetak (Native)</button>
              <button class="print-btn" style="background-color: #10b981;" onclick="downloadZIP()">Unduh ZIP (Gambar)</button>
              <button class="close-btn" onclick="window.close()">Tutup</button>
            </div>
          </div>

          <div class="cards-container" id="pdf-content">
            ${cardsHtml}
          </div>

          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
          <script>
            async function downloadZIP() {
              const btn = document.querySelector('button[onclick="downloadZIP()"]');
              const originalText = btn.innerText;
              btn.innerText = "Memproses ZIP (0%)...";
              btn.disabled = true;

              try {
                const zip = new JSZip();
                const wrappers = document.querySelectorAll('.card-pair-wrapper');
                const students = ${JSON.stringify(targetStudents)};
                const total = wrappers.length;
                
                // Tambahkan sedikit lebar window untuk html2canvas agar tidak memotong elemen
                const canvasOptions = { 
                  scale: 3, 
                  useCORS: true,
                  backgroundColor: '#ffffff',
                  windowWidth: document.documentElement.scrollWidth + 100
                };
                
                for (let i = 0; i < total; i++) {
                  const wrapper = wrappers[i];
                  const student = students[i];
                  
                  const safeName = (student.name || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
                  const safeNis = (student.nis || 'NoNIS').replace(/[^a-zA-Z0-9]/g, '_');
                  
                  const frontCard = wrapper.querySelector('.front');
                  const backCard = wrapper.querySelector('.back');

                  if (frontCard && backCard) {
                    // Capture Front
                    const canvasFront = await html2canvas(frontCard, canvasOptions);
                    const imgDataFront = canvasFront.toDataURL('image/png').split(',')[1];
                    zip.file(\`ID_\${safeNis}_\${safeName}_Bagian_Depan.png\`, imgDataFront, {base64: true});

                    // Capture Back
                    const canvasBack = await html2canvas(backCard, canvasOptions);
                    const imgDataBack = canvasBack.toDataURL('image/png').split(',')[1];
                    zip.file(\`ID_\${safeNis}_\${safeName}_Bagian_Belakang.png\`, imgDataBack, {base64: true});
                  } else {
                    // Fallback jika tidak menemukan front/back
                    const canvas = await html2canvas(wrapper, canvasOptions);
                    const imgData = canvas.toDataURL('image/png').split(',')[1];
                    zip.file(\`ID_\${safeNis}_\${safeName}.png\`, imgData, {base64: true});
                  }
                  
                  btn.innerText = \`Memproses ZIP (\${Math.round(((i + 1) / total) * 100)}%)...\`;
                }

                btn.innerText = "Mengemas ZIP...";
                const content = await zip.generateAsync({type:"blob"});
                saveAs(content, 'ID_Cards_${classNameTitle.replace(/\s+/g, '_')}.zip');
              } catch (error) {
                console.error("Error creating ZIP:", error);
                alert("Gagal membuat file ZIP.");
              } finally {
                btn.innerText = originalText;
                btn.disabled = false;
              }
            }

            window.onload = function() {
              const students = ${JSON.stringify(targetStudents)};
              students.forEach(s => {
                const barcodeContainer = document.getElementById('barcode-' + s.id);
                if (barcodeContainer) {
                  const barcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                  barcodeSvg.setAttribute("width", "100%");
                  barcodeSvg.setAttribute("height", "100%");
                  barcodeSvg.style.display = "block";
                  barcodeContainer.appendChild(barcodeSvg);
                  
                  JsBarcode(barcodeSvg, s.nis || s.id, {
                    format: "CODE128",
                    width: 2,
                    height: 40,
                    displayValue: false,
                    margin: 0,
                    background: "transparent",
                    lineColor: "#1e293b"
                  });
                }
              });
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div id="student-list-root" className="space-y-6">
      
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nama atau NIS siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50/70 border border-gray-100 pl-10 pr-4 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
          />
        </div>

        {/* Action button groupings */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Print all cards in current selection */}
          {filteredStudents.length > 0 && (
            <>
              <div className="flex items-center bg-gray-50 border border-gray-150 rounded-xl p-0.5 shrink-0">
                <button
                  onClick={() => setCodeType('qr')}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${codeType === 'qr' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  QR
                </button>
                <button
                  onClick={() => setCodeType('barcode')}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${codeType === 'barcode' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Barcode
                </button>
              </div>

              <button
                onClick={handlePrintAllQRs}
                className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-150 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                title="Cetak kartu kode siswa saat ini"
              >
                <Printer className="h-4 w-4 text-purple-600" />
                <span className="hidden sm:inline">Cetak Kode</span>
              </button>

              <button
                onClick={() => {
                  setBulkPrintClass(activeClass);
                  setIsBulkIdCardModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-150 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                title="Cetak ID Card / Kartu Pelajar semua siswa yang tampil"
              >
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span>Cetak ID Card</span>
              </button>
            </>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-150 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-150 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <FileUp className="h-4 w-4 text-amber-600" />
            <span className="hidden sm:inline">Impor Massal</span>
          </button>

          <button
            onClick={() => {
              setEditingStudent(null);
              setFormData({
                nis: '',
                name: '',
                gender: 'L',
                className: activeClass === 'Semua Kelas' ? 'XII MIPA 1' : activeClass,
                photo: '',
                parentPhone: ''
              });
              setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Siswa Baru</span>
          </button>
        </div>

      </div>

      {/* Grid List of Students */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full bg-white py-16 px-4 rounded-2xl border border-gray-100 shadow-xs text-center text-gray-400">
            <Users className="h-12 w-12 mx-auto stroke-1 mb-3 text-purple-200" />
            <p className="text-base font-semibold text-gray-700">Tidak Ada Siswa Terdaftar</p>
            <p className="text-xs mt-1 text-gray-400 max-w-sm mx-auto">
              Siswa tidak ditemukan untuk pencarian atau kelas saat ini. Daftarkan siswa baru atau impor file CSV.
            </p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div 
              key={student.id}
              className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-purple-200 shadow-xs flex items-center justify-between transition-all group"
            >
              <div className="flex items-center space-x-3.5 truncate">
                {/* Avatar with gender color code */}
                {student.photo ? (
                  <img src={student.photo} className="h-11 w-11 rounded-xl object-cover border border-gray-100 shrink-0" alt="Foto" />
                ) : (
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 uppercase tracking-wider ${
                    student.gender === 'L' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {student.name.slice(0, 2)}
                  </div>
                )}

                <div className="truncate">
                  <h5 className="font-bold text-gray-900 group-hover:text-purple-700 transition-colors text-sm truncate">{student.name}</h5>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-gray-400 font-medium">
                    <span className="font-mono text-gray-500">NIS: {student.nis}</span>
                    <span>•</span>
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-semibold text-[10px]">{student.className}</span>
                    {student.parentPhone && (
                      <>
                        <span>•</span>
                        <a 
                          href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          title="Hubungi Orang Tua"
                          className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md font-semibold text-[10px] flex items-center gap-1 hover:bg-green-100 transition-colors cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                          WA Ortu
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Actions (Hover trigger or tap) */}
              <div className="flex items-center space-x-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0">
                <button
                  onClick={() => setViewingQrStudent(student)}
                  className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                  title="Lihat QR Code Absen"
                >
                  <QrCode className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewingIdCardStudent(student)}
                  className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                  title="Pratinjau / Cetak ID Card"
                >
                  <CreditCard className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEditClick(student)}
                  className="p-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="Edit Data Siswa"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setStudentToDelete(student)}
                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                  title="Hapus Siswa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* MODAL 1: ADD / EDIT STUDENT DRAWER */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
              <div>
                <h4 className="font-bold text-lg">{editingStudent ? 'Edit Biodata Siswa' : 'Daftarkan Siswa Baru'}</h4>
                <p className="text-xs text-purple-100 mt-0.5">Isi data pokok siswa secara valid</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* NIS */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nomor Induk Siswa (NIS) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 21015"
                  value={formData.nis}
                  onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:bg-white focus:border-purple-500 transition-all"
                />
              </div>

              {/* Nama */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nama Lengkap Siswa <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap sesuai rapor..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                />
              </div>

              {/* WhatsApp Orang Tua */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">No. WhatsApp Orang Tua</label>
                <input
                  type="tel"
                  placeholder="Contoh: 08123456789"
                  value={formData.parentPhone || ''}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                />
              </div>

              {/* Gender and Class selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Jenis Kelamin</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Rombel / Kelas <span className="text-red-500">*</span></label>
                  <select
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-purple-500 transition-all"
                  >
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Foto Siswa */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Foto Siswa (Saran: Rasio 3:4 atau persegi)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2 px-4 border border-dashed border-gray-300 hover:border-purple-400 rounded-xl text-sm text-gray-600 hover:text-purple-600 font-bold transition-all bg-slate-50/50 hover:bg-purple-50/10">
                    <FileUp className="h-4 w-4 shrink-0" />
                    <span>{formData.photo ? 'Ubah Foto Siswa' : 'Pilih Foto Siswa'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1.5 * 1024 * 1024) {
                            alert('Ukuran foto terlalu besar! Gunakan foto di bawah 1.5MB agar dapat disimpan.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({ ...formData, photo: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {formData.photo && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, photo: '' })}
                      className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                {formData.photo && (
                  <div className="mt-2.5 flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <img src={formData.photo} className="h-12 w-12 object-cover rounded-md" alt="Pratinjau Foto Siswa" />
                    <span className="text-xs text-gray-400 font-semibold truncate flex-1">Foto siswa siap disimpan</span>
                  </div>
                )}
              </div>

              {/* Custom input for new class if needed */}
              <div className="pt-2 text-[11px] text-gray-400">
                💡 <em>Tips:</em> Untuk mengelompokkan kelas baru, Anda bisa mengetiknya langsung dari impor CSV atau mengubah setelan kelas.
              </div>

              {/* Form Toggles */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  {editingStudent ? 'Simpan Perubahan' : 'Daftarkan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK IMPORT MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0">
              <div>
                <h4 className="font-bold text-lg">Impor Siswa Secara Massal (CSV)</h4>
                <p className="text-xs text-amber-100 mt-0.5">Daftarkan puluhan siswa sekaligus menggunakan format teks terstruktur</p>
              </div>
              <button 
                onClick={() => setIsImportOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3.5 bg-amber-50 text-amber-900 border border-amber-100 rounded-xl text-xs">
                <p className="font-bold">Format Baris CSV:</p>
                <code className="block mt-1 font-mono bg-white p-2 rounded-md border text-amber-800">
                  NIS, Nama Lengkap, Jenis Kelamin (L/P), Kelas, Link Foto (Opsional), No WA Ortu (Opsional)<br />
                  21001, Ahmad Fauzi, L, XII MIPA 1, https://img.co/.., 08123456789<br />
                  21002, Citra Lestari, P, XII MIPA 1, , 08123456789
                </code>
                <p className="mt-2 text-[11px] text-amber-700">* Catatan: Pastikan penulisan Kelas konsisten agar filter absensi berfungsi dengan sempurna. Link Foto dan No WA bersifat opsional. Jika tak ada foto namun ingin isi No WA, kosongkan kolom foto seperti siswa ke-2.</p>
                
                <div className="mt-3.5 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-[11px] font-semibold text-amber-800">Gunakan berkas format standar agar tidak salah:</span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg text-[10px] transition-all shadow-sm cursor-pointer uppercase tracking-wider self-start sm:self-auto"
                  >
                    <Download className="h-3.5 w-3.5" /> Unduh Format (.csv)
                  </button>
                </div>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Drag & Drop or Click to Select File */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unggah Berkas CSV</label>
                <div 
                  className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-150 ${
                    isDragging 
                      ? 'border-amber-500 bg-amber-50/70 scale-[0.99]' 
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100/70'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                >
                  <input 
                    type="file" 
                    accept=".csv,text/csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(file);
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-full">
                      <FileUp className="h-6 w-6" />
                    </div>
                    <div className="text-xs font-semibold text-gray-700">
                      Tarik & lepas file CSV di sini, atau <span className="text-amber-600 font-bold underline">Pilih Berkas</span>
                    </div>
                    <p className="text-[10px] text-gray-400">Mendukung berkas teks format .csv</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Isi Data CSV (Pratinjau / Tempel)</label>
                  {csvRawText && (
                    <button 
                      type="button" 
                      onClick={() => setCsvRawText('')}
                      className="text-[10px] text-red-500 hover:underline font-semibold"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  placeholder="Tempel baris data siswa di sini atau unggah berkas CSV di atas..."
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:bg-white focus:border-purple-500 transition-all resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  Mulai Impor Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW & DOWNLOAD SINGLE QR CODE CARD */}
      {viewingQrStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-100 w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h4 className="font-black text-gray-900">Kartu QR Absensi</h4>
                <p className="text-xs text-gray-400 mt-0.5">Simpan atau cetak kartu murid ini</p>
              </div>
              <button 
                onClick={() => setViewingQrStudent(null)}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center text-center">
              {/* Card visual template */}
              <div id="student-qr-card-print" className="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-200/60 p-5 rounded-2xl w-full flex flex-col items-center shadow-xs">
                <span className="text-[10px] font-black text-purple-600 tracking-widest uppercase mb-1">SMA NEGERI 1 ABSENSI</span>
                
                <h3 className="font-bold text-gray-850 text-base">{viewingQrStudent.name}</h3>
                <span className="text-xs text-gray-400 font-mono">NIS: {viewingQrStudent.nis} | {viewingQrStudent.className}</span>

                {/* Actual SVG Code */}
                <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-100 my-4 flex justify-center items-center">
                  {codeType === 'barcode' ? (
                    <div className="w-full max-w-[200px] h-16">
                      <Barcode value={viewingQrStudent.nis} />
                    </div>
                  ) : (
                    <QRCodeSVG 
                      value={viewingQrStudent.nis} 
                      size={150} 
                      level="H" 
                      includeMargin={false}
                    />
                  )}
                </div>

                <p className="text-[10px] text-gray-500 font-medium">Dekatkan kartu ini pada kamera scanner sekolah</p>
              </div>

              {/* Single card action downloads */}
              <div className="grid grid-cols-2 gap-3 w-full mt-5">
                <button
                  onClick={() => {
                    const svgElement = document.querySelector('#student-qr-card-print svg');
                    if (!svgElement) return;
                    const svgString = new XMLSerializer().serializeToString(svgElement);
                    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                    const URL_OBJ = URL.createObjectURL(svgBlob);
                    const link = document.createElement('a');
                    link.href = URL_OBJ;
                    link.setAttribute('download', `Kode_${viewingQrStudent.name.replace(/\s+/g, '_')}.svg`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" /> Unduh Kode
                </button>
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Cetak Kartu Absen - ${viewingQrStudent.name}</title>
                          <style>
                            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 90vh; }
                            .card { border: 2px solid #ddd; padding: 25px; border-radius: 16px; text-align: center; max-width: 280px; }
                            h3 { margin: 0 0 5px; font-size: 18px; }
                            p { margin: 0 0 15px; color: #666; font-size: 12px; }
                            .qr { display: inline-block; margin: 15px 0; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <h3>${viewingQrStudent.name}</h3>
                            <p>NIS: ${viewingQrStudent.nis} | Kelas: ${viewingQrStudent.className}</p>
                            <div class="qr" id="qr"></div>
                          </div>
                          <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
                          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                          <script>
                            const codeType = '${codeType}';
                            const container = document.getElementById('qr');
                            if(codeType === 'barcode') {
                              const canvas = document.createElement('canvas');
                              JsBarcode(canvas, '${viewingQrStudent.nis}', {
                                format: "CODE128",
                                width: 2,
                                height: 60,
                                displayValue: false,
                                margin: 0
                              });
                              container.appendChild(canvas);
                            } else {
                              const qr = qrcode(0, 'H');
                              qr.addData('${viewingQrStudent.nis}');
                              qr.make();
                              container.innerHTML = qr.createSvgTag(8, 1);
                            }
                            setTimeout(() => {
                              window.print();
                              window.close();
                            }, 300);
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Cetak Kartu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: SINGLE STUDENT ID CARD PREVIEW */}
      {viewingIdCardStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">Pratinjau ID Card Pelajar</h3>
                  <p className="text-xs text-gray-400 font-medium">Atur & sesuaikan desain kartu tanda pelajar sebelum dicetak</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingIdCardStudent(null)}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/30">
              {/* Configuration Panel */}
              <div className="lg:col-span-5 space-y-5 bg-white p-5 rounded-2xl border border-gray-100/80 shadow-xs flex flex-col justify-between">
                <div className="space-y-5">
                  {/* Theme selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tema Warna Kartu</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setIdCardTheme('navy')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          idCardTheme === 'navy' 
                            ? 'border-blue-500 bg-blue-50/30 text-blue-700 font-bold' 
                            : 'border-gray-150 bg-white hover:bg-gray-50 text-gray-500'
                        }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-indigo-900 border border-white shadow-xs" />
                        <span className="text-[10px]">Navy</span>
                      </button>

                      <button
                        onClick={() => setIdCardTheme('crimson')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          idCardTheme === 'crimson' 
                            ? 'border-rose-500 bg-rose-50/30 text-rose-700 font-bold' 
                            : 'border-gray-150 bg-white hover:bg-gray-50 text-gray-500'
                        }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-rose-900 border border-white shadow-xs" />
                        <span className="text-[10px]">Crimson</span>
                      </button>

                      <button
                        onClick={() => setIdCardTheme('emerald')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          idCardTheme === 'emerald' 
                            ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700 font-bold' 
                            : 'border-gray-150 bg-white hover:bg-gray-50 text-gray-500'
                        }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-emerald-900 border border-white shadow-xs" />
                        <span className="text-[10px]">Emerald</span>
                      </button>

                      <button
                        onClick={() => setIdCardTheme('gold')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          idCardTheme === 'gold' 
                            ? 'border-amber-500 bg-amber-50/30 text-amber-700 font-bold' 
                            : 'border-gray-150 bg-white hover:bg-gray-50 text-gray-500'
                        }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-amber-900 border border-white shadow-xs" />
                        <span className="text-[10px]">Gold</span>
                      </button>
                    </div>
                  </div>

                  {/* Layout Orientation Selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Orientasi Kartu</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setIdCardLayout('portrait')}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-xs font-semibold cursor-pointer ${
                          idCardLayout === 'portrait'
                            ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-3.5 h-5 border border-current rounded-xs shrink-0" />
                        Portrait (Tegak)
                      </button>
                      <button
                        onClick={() => setIdCardLayout('landscape')}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-xs font-semibold cursor-pointer ${
                          idCardLayout === 'landscape'
                            ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-5 h-3.5 border border-current rounded-xs shrink-0" />
                        Landscape (Lebar)
                      </button>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none mb-3">
                      <input
                        type="checkbox"
                        checked={includeBackCard}
                        onChange={(e) => setIncludeBackCard(e.target.checked)}
                        className="rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-700">Cetak Dua Sisi (Bolak-balik)</span>
                        <p className="text-[10px] text-gray-400 font-medium">Sertakan halaman belakang yang berisi ketentuan penggunaan kartu</p>
                      </div>
                    </label>

                    {/* Dimensi & Elemen Kartu */}
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Kustomisasi Lanjutan</span>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lebar Kartu (mm)</label>
                          <input
                            type="number"
                            value={idCardConfig.widthMm}
                            onChange={(e) => updateIdCardConfig('widthMm', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tinggi Kartu (mm)</label>
                          <input
                            type="number"
                            value={idCardConfig.heightMm}
                            onChange={(e) => updateIdCardConfig('heightMm', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-150">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Elemen Yang Ditampilkan</label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries({
                            photo: 'Foto Siswa',
                            nis: 'NIS / NISN',
                            barcode: 'QR Code',
                            signature: 'Tanda Tangan'
                          }).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={idCardConfig.visibility[key as keyof typeof idCardConfig.visibility]}
                                onChange={() => toggleVisibility(key as keyof typeof idCardConfig.visibility)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                              <span className="text-[11px] font-semibold text-gray-600">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Custom Background Uploads */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Background Depan</label>
                          <div className="flex flex-col gap-1.5">
                            <label className="cursor-pointer flex items-center justify-center gap-1.5 py-1.5 px-2 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg text-[10px] text-gray-600 hover:text-indigo-600 font-bold transition-all bg-white">
                              <FileUp className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{idCardConfig.bgFront ? 'Ubah' : 'Unggah'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'bgFront')}
                                className="hidden"
                              />
                            </label>
                            {idCardConfig.bgFront && (
                              <button
                                onClick={() => updateIdCardConfig('bgFront', null)}
                                className="py-1 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg text-[10px] transition-colors"
                              >
                                Hapus Gambar
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Background Belakang</label>
                          <div className="flex flex-col gap-1.5">
                            <label className="cursor-pointer flex items-center justify-center gap-1.5 py-1.5 px-2 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg text-[10px] text-gray-600 hover:text-indigo-600 font-bold transition-all bg-white">
                              <FileUp className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{idCardConfig.bgBack ? 'Ubah' : 'Unggah'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'bgBack')}
                                className="hidden"
                              />
                            </label>
                            {idCardConfig.bgBack && (
                              <button
                                onClick={() => updateIdCardConfig('bgBack', null)}
                                className="py-1 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg text-[10px] transition-colors"
                              >
                                Hapus Gambar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tanda Tangan & Stempel Settings */}
                  <div className="pt-4 border-t border-gray-100 space-y-3.5">
                    <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tanda Tangan & Stempel</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nama Kepala Sekolah</label>
                        <input
                          type="text"
                          value={headmasterName}
                          onChange={(e) => setHeadmasterName(e.target.value)}
                          placeholder="Nama Kepala Sekolah"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tahun Ajaran</label>
                        <input
                          type="text"
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          placeholder="TA. 2026/2027"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {/* Signature Upload */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanda Tangan (Saran: PNG transparan)</label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-1.5 px-3 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg text-xs text-gray-600 hover:text-indigo-600 font-bold transition-all bg-slate-50/50 hover:bg-indigo-50/10">
                            <FileUp className="h-4 w-4 shrink-0" />
                            <span>{signatureImage ? 'Ubah Gambar' : 'Pilih File'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, 'signature')}
                              className="hidden"
                            />
                          </label>
                          {signatureImage && (
                            <button
                              onClick={() => setSignatureImage(null)}
                              className="px-2.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                              title="Hapus TTD"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                        {signatureImage && (
                          <div className="mt-1.5 flex items-center gap-2 p-1 bg-slate-50 border border-slate-100 rounded-md">
                            <img src={signatureImage} className="h-8 max-w-[80px] object-contain rounded" alt="Pratinjau TTD" />
                            <span className="text-[10px] text-gray-400 font-semibold truncate flex-1">TTD Terunggah</span>
                          </div>
                        )}
                      </div>

                      {/* Stamp Upload */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stempel Sekolah (Saran: PNG transparan)</label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-1.5 px-3 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg text-xs text-gray-600 hover:text-indigo-600 font-bold transition-all bg-slate-50/50 hover:bg-indigo-50/10">
                            <FileUp className="h-4 w-4 shrink-0" />
                            <span>{stampImage ? 'Ubah Gambar' : 'Pilih File'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, 'stamp')}
                              className="hidden"
                            />
                          </label>
                          {stampImage && (
                            <button
                              onClick={() => setStampImage(null)}
                              className="px-2.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                              title="Hapus Stempel"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                        {stampImage && (
                          <div className="mt-1.5 flex items-center gap-2 p-1 bg-slate-50 border border-slate-100 rounded-md">
                            <img src={stampImage} className="h-8 w-8 object-contain rounded" alt="Pratinjau Stempel" />
                            <span className="text-[10px] text-gray-400 font-semibold truncate flex-1">Stempel Terunggah</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-100 mt-6 lg:mt-0">
                  <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                      Dimensi kartu disesuaikan dengan ukuran standar **CR-80** (5.4cm x 8.5cm). Siap dilipat dan dilaminating setelah dicetak.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Live Render Preview */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center gap-6 p-4">
                <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest">TAMPILAN PRATINJAU KARTU</span>
                
                <div className={`flex ${idCardLayout === 'portrait' ? 'flex-col sm:flex-row' : 'flex-col'} items-center gap-6 justify-center w-full`}>
                  {/* FRONT PREVIEW */}
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400">Bagian Depan</span>
                    <div 
                      className={`relative box-sizing bg-white border border-gray-200 shadow-md flex flex-col overflow-hidden transition-all select-none ${
                        idCardLayout === 'portrait' 
                          ? 'w-[204px] h-[321px] rounded-[13px]' 
                          : 'w-[321px] h-[204px] rounded-[13px]'
                      }`}
                      style={{
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }}
                    >
                      {idCardConfig.bgFront && (
                        <img src={idCardConfig.bgFront} className="absolute inset-0 w-full h-full object-cover opacity-25 z-0" alt="Background Front" />
                      )}
                      {/* Top Gradient Band */}
                      <div className={`relative z-10 px-2 py-1 flex items-center gap-1.5 ${
                        idCardTheme === 'navy' ? 'bg-gradient-to-br from-indigo-950 to-blue-900' :
                        idCardTheme === 'crimson' ? 'bg-gradient-to-br from-neutral-950 to-rose-900' :
                        idCardTheme === 'emerald' ? 'bg-gradient-to-br from-stone-950 to-emerald-900' :
                        'bg-gradient-to-br from-neutral-950 to-amber-900'
                      } text-white`} style={{ height: idCardLayout === 'portrait' ? '41.5px' : '38px' }}>
                        <div className="p-1 bg-white/10 rounded-full">
                          <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                        </div>
                        <div className="flex flex-col justify-center overflow-hidden leading-tight">
                          <span className="text-[7.5px] font-black uppercase tracking-wide truncate max-w-[140px]">{schoolName}</span>
                          <span className="text-[5.5px] font-semibold text-amber-300">KARTU IDENTITAS SISWA</span>
                        </div>
                      </div>

                      {/* Indonesian Red and White Strip */}
                      <div className="h-[2px] w-full bg-linear-to-r from-red-500 from-50% to-white to-50%" />

                      {/* Card Content Grid */}
                      {idCardLayout === 'portrait' ? (
                        /* PORTRAIT LAYOUT CONTENT */
                        <div className="flex-1 flex flex-col items-center p-3 justify-between bg-radial from-slate-50 to-white">
                          {/* Avatar Outline */}
                          {idCardConfig.visibility.photo && (
                            <div className={`h-[60px] w-[60px] rounded-lg border-2 p-0.5 overflow-hidden shadow-xs bg-white relative z-10 ${
                              idCardTheme === 'navy' ? 'border-blue-700' :
                              idCardTheme === 'crimson' ? 'border-rose-700' :
                              idCardTheme === 'emerald' ? 'border-emerald-700' :
                              'border-amber-700'
                            }`}>
                              {viewingIdCardStudent.photo ? (
                                <img src={viewingIdCardStudent.photo} className="h-full w-full rounded-md object-cover" alt="Foto Siswa" />
                              ) : (
                                <div className={`h-full w-full rounded-md flex items-center justify-center font-bold text-xs uppercase tracking-wider ${
                                  viewingIdCardStudent.gender === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {viewingIdCardStudent.gender === 'L' ? (
                                    <svg viewBox="0 0 100 100" className="w-full h-full">
                                      <rect width="100%" height="100%" fill="#eff6ff"/>
                                      <circle cx="50" cy="38" r="16" fill="#93c5fd"/>
                                      <path d="M22 80 C 22 58, 35 55, 50 55 C 65 55, 78 58, 78 80 Z" fill="#3b82f6"/>
                                    </svg>
                                  ) : (
                                    <svg viewBox="0 0 100 100" className="w-full h-full">
                                      <rect width="100%" height="100%" fill="#fff1f2"/>
                                      <circle cx="50" cy="38" r="16" fill="#fda4af"/>
                                      <path d="M24 80 C 24 58, 36 55, 50 55 C 64 55, 76 58, 76 80 Z" fill="#f43f5e"/>
                                    </svg>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Student Identifiers */}
                          <div className="text-center w-full relative z-10">
                            <h4 className="font-extrabold text-[10px] text-gray-900 uppercase tracking-tight truncate leading-tight">{viewingIdCardStudent.name}</h4>
                            {idCardConfig.visibility.nis && (
                              <span className="text-[7.5px] font-mono text-gray-500 font-semibold">NIS: {viewingIdCardStudent.nis}</span>
                            )}
                          </div>

                          {/* Metadata Table */}
                          <div className="w-full bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex flex-col gap-1 text-[6.5px] relative z-10">
                            <div className="flex justify-between border-b border-gray-100 pb-0.5">
                              <span className="text-gray-400 font-bold uppercase">KELAS</span>
                              <span className="text-gray-700 font-extrabold">{viewingIdCardStudent.className}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-0.5">
                              <span className="text-gray-400 font-bold uppercase">GENDER</span>
                              <span className="text-gray-700 font-extrabold">{viewingIdCardStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 font-bold uppercase">STATUS</span>
                              <span className="text-emerald-600 font-extrabold">AKTIF</span>
                            </div>
                          </div>

                          {/* Linear Barcode (Barcode Batang) */}
                          {idCardConfig.visibility.barcode && (
                            <div className="w-full bg-white border border-gray-150 rounded-lg p-1.5 flex flex-col items-center justify-center my-1.5 shadow-3xs relative z-10">
                              <div className="w-full h-[24px] text-slate-800">
                                <Barcode value={viewingIdCardStudent.nis || viewingIdCardStudent.id} />
                              </div>
                              <span className="text-[5.5px] font-mono text-gray-400 font-extrabold tracking-widest mt-0.5 uppercase">
                                * {viewingIdCardStudent.nis || viewingIdCardStudent.id} *
                              </span>
                            </div>
                          )}

                          {/* Footer details row */}
                          <div className="w-full flex flex-col items-center justify-center border-t border-slate-100 pt-1 h-[68px] text-center relative z-10">
                            <span className="bg-emerald-500 text-white text-[4px] font-extrabold px-1 py-0.5 rounded-sm absolute top-1 right-2">{academicYear}</span>
                            <span className="text-[4.5px] font-bold text-gray-400 leading-none mt-1">Kepala Sekolah,</span>
                            
                            {idCardConfig.visibility.signature && (
                              <div className="relative w-full h-[24px] flex justify-center items-center">
                                {signatureImage ? (
                                  <img src={signatureImage} className="h-full max-w-[60px] object-contain z-10 absolute" alt="Tanda Tangan" />
                                ) : (
                                  /* Vector Stamp/Signature layer */
                                  <svg viewBox="0 0 100 40" className="h-full absolute opacity-80" style={{ color: idCardTheme === 'navy' ? '#2563eb' : idCardTheme === 'crimson' ? '#be123c' : idCardTheme === 'emerald' ? '#047857' : '#b45309' }}>
                                    <path d="M10 25 C 18 12, 28 8, 38 18 C 45 25, 42 6, 52 14 C 60 22, 68 25, 82 18 C 88 16, 76 32, 92 25" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                                {stampImage ? (
                                  <img src={stampImage} className="absolute h-[32px] w-[32px] object-contain opacity-65 pointer-events-none translate-x-3 z-20" alt="Stempel" />
                                ) : (
                                  <div className="absolute opacity-30 scale-60" style={{ color: idCardTheme === 'navy' ? '#2563eb' : idCardTheme === 'crimson' ? '#be123c' : idCardTheme === 'emerald' ? '#047857' : '#b45309' }}>
                                    <ShieldCheck className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                            )}
                            <span className="text-[5px] font-black text-gray-800 underline leading-none mb-1 mt-auto">{idCardConfig.visibility.signature ? headmasterName : ''}</span>
                          </div>
                        </div>
                      ) : (
                        /* LANDSCAPE LAYOUT CONTENT */
                        <div className="flex-1 flex flex-row p-2.5 gap-2 bg-radial from-slate-50 to-white relative z-10">
                          {/* Left layout col */}
                          <div className="w-[65px] flex flex-col justify-between items-center border-r border-slate-100 pr-2">
                            {idCardConfig.visibility.photo ? (
                              <div className={`h-[48px] w-[48px] rounded-lg border p-0.5 overflow-hidden shadow-3xs bg-white ${
                                idCardTheme === 'navy' ? 'border-blue-700' :
                                idCardTheme === 'crimson' ? 'border-rose-700' :
                                idCardTheme === 'emerald' ? 'border-emerald-700' :
                                'border-amber-700'
                              }`}>
                                {viewingIdCardStudent.photo ? (
                                  <img src={viewingIdCardStudent.photo} className="h-full w-full rounded-md object-cover" alt="Foto Siswa" />
                                ) : viewingIdCardStudent.gender === 'L' ? (
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    <rect width="100%" height="100%" fill="#eff6ff"/>
                                    <circle cx="50" cy="38" r="16" fill="#93c5fd"/>
                                    <path d="M22 80 C 22 58, 35 55, 50 55 C 65 55, 78 58, 78 80 Z" fill="#3b82f6"/>
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    <rect width="100%" height="100%" fill="#fff1f2"/>
                                    <circle cx="50" cy="38" r="16" fill="#fda4af"/>
                                    <path d="M24 80 C 24 58, 36 55, 50 55 C 64 55, 76 58, 76 80 Z" fill="#f43f5e"/>
                                  </svg>
                                )}
                              </div>
                            ) : (
                              <div className="h-[48px] w-[48px]"></div>
                            )}
                            
                            {idCardConfig.visibility.barcode && (
                              <div className="bg-white p-1 rounded border border-gray-200 mt-1 shadow-3xs flex flex-col items-center justify-center w-full">
                                <div className="w-[45px] h-[18px]">
                                  <Barcode value={viewingIdCardStudent.nis || viewingIdCardStudent.id} />
                                </div>
                                <span className="text-[4px] font-mono text-gray-400 font-extrabold mt-0.5 uppercase tracking-wider text-center">
                                  {viewingIdCardStudent.nis || viewingIdCardStudent.id}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right layout col */}
                          <div className="flex-1 flex flex-col justify-between pl-1 h-full relative">
                            <div>
                              <h4 className="font-extrabold text-[10px] text-gray-900 uppercase tracking-tight leading-none truncate max-w-[190px]">{viewingIdCardStudent.name}</h4>
                              {idCardConfig.visibility.nis && (
                                <span className="text-[6px] font-mono text-gray-500 font-semibold leading-none">NIS: {viewingIdCardStudent.nis}</span>
                              )}
                            </div>

                            <div className="bg-slate-50 p-1 rounded border border-slate-100 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[5.8px] font-bold text-gray-700 my-1">
                              <div><span className="text-gray-400">KELAS:</span> {viewingIdCardStudent.className}</div>
                              <div><span className="text-gray-400">GENDER:</span> {viewingIdCardStudent.gender === 'L' ? 'L' : 'P'}</div>
                              <div className="col-span-2"><span className="text-gray-400">STATUS:</span> <span className="text-emerald-600">SISWA AKTIF</span></div>
                            </div>

                            {/* Signatures */}
                            <div className="flex items-end justify-between relative pt-1">
                              <span className="text-[4px] font-extrabold text-white bg-emerald-500 px-1 py-0.5 rounded-xs">{academicYear}</span>
                              
                              {idCardConfig.visibility.signature && (
                                <div className="flex flex-col items-end leading-none">
                                  <span className="text-[4.5px] font-bold text-gray-400 mb-0.5">Kepala Sekolah,</span>
                                  <div className="relative w-[70px] h-[16px] flex justify-end items-center">
                                    {signatureImage ? (
                                      <img src={signatureImage} className="h-[22px] max-w-[50px] object-contain z-10 absolute right-1" alt="Tanda Tangan" />
                                    ) : (
                                      <svg viewBox="0 0 100 40" className="h-[22px] absolute right-0 opacity-80" style={{ color: idCardTheme === 'navy' ? '#2563eb' : idCardTheme === 'crimson' ? '#be123c' : idCardTheme === 'emerald' ? '#047857' : '#b45309' }}>
                                        <path d="M10 25 C 18 12, 28 8, 38 18 C 45 25, 42 6, 52 14 C 60 22, 68 25, 82 18 C 88 16, 76 32, 92 25" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                    {stampImage ? (
                                      <img src={stampImage} className="absolute h-[24px] w-[24px] object-contain opacity-65 pointer-events-none right-4 z-20" alt="Stempel" />
                                    ) : null}
                                  </div>
                                  <span className="text-[5px] font-black text-gray-800 underline">{headmasterName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BACK PREVIEW */}
                  {includeBackCard && (
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400">Bagian Belakang</span>
                      <div 
                        className={`relative box-sizing bg-white border border-gray-200 shadow-md flex flex-col overflow-hidden transition-all select-none p-2.5 ${
                          idCardLayout === 'portrait' 
                            ? 'w-[204px] h-[321px] rounded-[13px] justify-between' 
                            : 'w-[321px] h-[204px] rounded-[13px] justify-between'
                        }`}
                        style={{
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact'
                        }}
                      >
                        {idCardConfig.bgBack && (
                          <img src={idCardConfig.bgBack} className="absolute inset-0 w-full h-full object-cover opacity-15 z-0" alt="Background Back" />
                        )}
                        {/* Header banner */}
                        <div className={`relative z-10 p-1 rounded flex items-center justify-center gap-1.5 ${
                          idCardTheme === 'navy' ? 'bg-indigo-900' :
                          idCardTheme === 'crimson' ? 'bg-rose-900' :
                          idCardTheme === 'emerald' ? 'bg-emerald-900' :
                          'bg-amber-900'
                        } text-white font-extrabold text-[6px] uppercase tracking-wider`}>
                          <BookOpen className="h-2.5 w-2.5 text-amber-300" />
                          <span>Ketentuan Kartu Siswa</span>
                        </div>

                        {/* Rules */}
                        <div className={`relative z-10 flex flex-col gap-1.5 ${idCardLayout === 'portrait' ? 'my-2' : 'grid grid-cols-2 gap-2 my-1'}`}>
                          <div className="flex gap-1 items-start text-[5px] text-gray-600 leading-normal">
                            <span className="h-3 w-3 rounded-full bg-slate-100 flex items-center justify-center font-bold shrink-0 text-slate-500">1</span>
                            <p>Kartu ini adalah identitas resmi di lingkungan sekolah.</p>
                          </div>
                          <div className="flex gap-1 items-start text-[5px] text-gray-600 leading-normal">
                            <span className="h-3 w-3 rounded-full bg-slate-100 flex items-center justify-center font-bold shrink-0 text-slate-500">2</span>
                            <p>Wajib dibawa setiap hari untuk absen tap mandiri.</p>
                          </div>
                          <div className="flex gap-1 items-start text-[5px] text-gray-600 leading-normal">
                            <span className="h-3 w-3 rounded-full bg-slate-100 flex items-center justify-center font-bold shrink-0 text-slate-500">3</span>
                            <p>Jangan mencoret-coret, melipat, atau membagikan ke orang lain.</p>
                          </div>
                          <div className="flex gap-1 items-start text-[5px] text-gray-600 leading-normal">
                            <span className="h-3 w-3 rounded-full bg-slate-100 flex items-center justify-center font-bold shrink-0 text-slate-500">4</span>
                            <p>Jika kartu hilang, harap hubungi Tata Usaha sekolah.</p>
                          </div>
                        </div>

                        {/* Barcode & label */}
                        <div className="relative z-10 border-t border-slate-100 pt-2 flex flex-col items-center gap-1">
                          <div className="w-full h-[15px] bg-linear-to-r from-neutral-800 from-5% to-white to-5% flex items-center justify-center" 
                               style={{
                                 background: 'linear-gradient(90deg, #111 2%, #fff 2%, #fff 4%, #111 4%, #111 8%, #fff 8%, #111 11%, #fff 11%, #111 15%, #fff 15%, #111 22%, #fff 22%, #111 26%, #fff 26%, #111 31%, #fff 31%, #111 38%, #fff 38%, #111 42%, #fff 42%, #111 48%, #fff 48%, #111 51%, #fff 51%, #111 58%, #fff 58%, #111 63%, #fff 63%, #111 70%, #fff 70%, #111 72%, #fff 72%, #111 78%, #fff 78%, #111 82%, #fff 82%, #111 88%, #fff 88%, #111 94%, #fff 94%, #111 100%)',
                                 opacity: 0.7
                               }}
                          />
                          <span className="text-[4px] font-extrabold text-gray-400 uppercase tracking-widest leading-none">ABSENSI DIGITAL QR INDONESIA</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setViewingIdCardStudent(null)}
                className="px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handlePrintIDCardsAction([viewingIdCardStudent], viewingIdCardStudent.name)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-sm shadow-indigo-100"
              >
                <Printer className="h-4 w-4" /> Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK STUDENTS ID CARD PRINTING CONFIGURATION */}
      {isBulkIdCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">Cetak ID Card Massal</h3>
                  <p className="text-xs text-gray-400 font-medium">Buat kartu tanda pelajar secara kolektif</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBulkIdCardModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">TARGET CETAK (KELAS)</label>
                  <select
                    value={bulkPrintClass}
                    onChange={(e) => setBulkPrintClass(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black rounded-xl shrink-0 mt-5">
                  {bulkTargetStudents.length} Siswa
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tema Warna</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setIdCardTheme('navy')}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      idCardTheme === 'navy' ? 'border-blue-500 bg-blue-50/20 text-blue-700 font-bold' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <div className="h-4.5 w-4.5 rounded-full bg-indigo-900 border border-white shadow-3xs" />
                    <span className="text-[9px]">Navy</span>
                  </button>

                  <button
                    onClick={() => setIdCardTheme('crimson')}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      idCardTheme === 'crimson' ? 'border-rose-500 bg-rose-50/20 text-rose-700 font-bold' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <div className="h-4.5 w-4.5 rounded-full bg-rose-900 border border-white shadow-3xs" />
                    <span className="text-[9px]">Crimson</span>
                  </button>

                  <button
                    onClick={() => setIdCardTheme('emerald')}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      idCardTheme === 'emerald' ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 font-bold' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <div className="h-4.5 w-4.5 rounded-full bg-emerald-900 border border-white shadow-3xs" />
                    <span className="text-[9px]">Emerald</span>
                  </button>

                  <button
                    onClick={() => setIdCardTheme('gold')}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      idCardTheme === 'gold' ? 'border-amber-500 bg-amber-50/20 text-amber-700 font-bold' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <div className="h-4.5 w-4.5 rounded-full bg-amber-900 border border-white shadow-3xs" />
                    <span className="text-[9px]">Gold</span>
                  </button>
                </div>
              </div>

              {/* Layout orientation */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Orientasi Kartu</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIdCardLayout('portrait')}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-xs font-semibold cursor-pointer ${
                      idCardLayout === 'portrait' ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700' : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <div className="w-3 h-4 border border-current rounded-xs shrink-0" />
                    Portrait
                  </button>
                  <button
                    onClick={() => setIdCardLayout('landscape')}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-xs font-semibold cursor-pointer ${
                      idCardLayout === 'landscape' ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700' : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <div className="w-4 h-3 border border-current rounded-xs shrink-0" />
                    Landscape
                  </button>
                </div>
              </div>

              {/* Back card checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeBackCard}
                    onChange={(e) => setIncludeBackCard(e.target.checked)}
                    className="rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-700">Cetak Dua Sisi (Bolak-balik)</span>
                    <p className="text-[10px] text-gray-400 font-medium">Sertakan halaman belakang ketentuan penggunaan kartu</p>
                  </div>
                </label>
              </div>

              {/* Tanda Tangan & Stempel Settings */}
              <div className="pt-4 border-t border-gray-150 space-y-3">
                <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tanda Tangan & Stempel Kepala Sekolah</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nama Kepala Sekolah</label>
                    <input
                      type="text"
                      value={headmasterName}
                      onChange={(e) => setHeadmasterName(e.target.value)}
                      placeholder="Nama Kepala Sekolah"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tahun Ajaran</label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="TA. 2026/2027"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Signature File */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanda Tangan</label>
                    <div className="flex items-center gap-1.5">
                      <label className="flex-1 cursor-pointer flex items-center justify-center gap-1 py-1 px-2 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg text-[10px] text-gray-600 hover:text-indigo-600 font-bold transition-all bg-slate-50/50">
                        <FileUp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{signatureImage ? 'Ubah' : 'Pilih'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'signature')}
                          className="hidden"
                        />
                      </label>
                      {signatureImage && (
                        <button
                          onClick={() => setSignatureImage(null)}
                          className="px-2 py-1 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stamp File */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stempel Sekolah</label>
                    <div className="flex items-center gap-1.5">
                      <label className="flex-1 cursor-pointer flex items-center justify-center gap-1 py-1 px-2 border border-dashed border-gray-300 hover:border-indigo-400 rounded-lg text-[10px] text-gray-600 hover:text-indigo-600 font-bold transition-all bg-slate-50/50">
                        <FileUp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{stampImage ? 'Ubah' : 'Pilih'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'stamp')}
                          className="hidden"
                        />
                      </label>
                      {stampImage && (
                        <button
                          onClick={() => setStampImage(null)}
                          className="px-2 py-1 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100/50 flex gap-2">
                <AlertCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                  Saat Anda mengklik "Mulai Cetak Massal", sistem akan membuka jendela baru yang memuat daftar pratinjau seluruh kartu siap cetak. Silakan gunakan opsi cetak browser (Save as PDF atau kirim langsung ke printer).
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsBulkIdCardModalOpen(false)}
                className="px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setIsBulkIdCardModalOpen(false);
                  handlePrintIDCardsAction(bulkTargetStudents, bulkPrintClass);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-sm shadow-indigo-100"
              >
                <Printer className="h-4 w-4" /> Mulai Cetak Massal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Hapus Data Siswa?</h3>
              <p className="text-sm text-gray-500">
                Apakah Anda yakin ingin menghapus data siswa <span className="font-bold text-gray-800">{studentToDelete.name}</span>? Semua riwayat absensinya juga akan ikut terhapus secara permanen.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setStudentToDelete(null)}
                className="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteStudent(studentToDelete.id);
                  setStudentToDelete(null);
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
