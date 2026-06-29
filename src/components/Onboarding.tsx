import { useState, FormEvent } from 'react';
import { School, ChevronRight, Settings } from 'lucide-react';
import { AttendanceConfig } from '../types';

interface OnboardingProps {
  onComplete: (config: Omit<AttendanceConfig, 'selectedClassFilter'>) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [schoolName, setSchoolName] = useState('');
  const [checkInStart, setCheckInStart] = useState('06:00');
  const [checkInEnd, setCheckInEnd] = useState('07:30');
  const [logoUrl, setLogoUrl] = useState('');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('Ukuran logo terlalu besar. Maksimal 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;
    
    onComplete({
      schoolName,
      checkInStart,
      checkInEnd,
      waAutoSend: false,
      waApiToken: '',
      logoUrl
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-purple-700 p-8 text-center text-white">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
            <School className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Selamat Datang di Master Absensi</h1>
          <p className="text-purple-100 text-sm">Aplikasi Master Absensi Offline-First. Silakan atur konfigurasi awal untuk instansi Anda.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Sekolah / Instansi</label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Contoh: SMA Negeri 1 Nusantara"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Logo Instansi / Sekolah (Opsional)</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-slate-50 border border-slate-200 p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
                    <School className="w-5 h-5 opacity-50" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleLogoUpload}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all cursor-pointer"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Jam Mulai Absen</label>
                <input
                  type="time"
                  required
                  value={checkInStart}
                  onChange={(e) => setCheckInStart(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Batas Waktu (Terlambat)</label>
                <input
                  type="time"
                  required
                  value={checkInEnd}
                  onChange={(e) => setCheckInEnd(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 border border-blue-100 text-blue-800 text-sm">
            <Settings className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
            <p>Aplikasi ini menyimpan semua data secara lokal di perangkat (Offline-First). Setup ini mengubah aplikasi copy menjadi milik instansi Anda secara independen.</p>
          </div>

          <button
            type="submit"
            className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group"
          >
            <span>Mulai Gunakan Aplikasi</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
}
