import {
  useEffect,
  useRef,
  useState,
  useMemo,
  ChangeEvent,
  FormEvent,
} from "react";
import { Student, AttendanceRecord } from "../types";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Play,
  Square,
  Keyboard,
  Sparkles,
  Volume2,
  ScanLine,
} from "lucide-react";

// Web Audio API helper for retro audio feedback
function playBeep(success: boolean) {
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      // High pleasant success beep
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Lower warning double-beep/buzz
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, ctx.currentTime); // Low G
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Audio feedback failed to play", e);
  }
}

interface QRScannerProps {
  students: Student[];
  records: AttendanceRecord[];
  onAttendanceSuccess: (
    studentId: string,
    verifiedBy: "qr" | "manual",
    status?: "hadir" | "sakit" | "izin" | "alpa",
  ) => {
    success: boolean;
    message: string;
    studentName?: string;
    parentPhone?: string;
  };
}

export default function QRScanner({
  students,
  records,
  onAttendanceSuccess,
}: QRScannerProps) {
  const [activeTab, setActiveTab] = useState<"hardware" | "manual">("hardware");
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    name?: string;
    parentPhone?: string;
  } | null>(null);
  const [manualNis, setManualNis] = useState<string>("");
  const [manualStatus, setManualStatus] = useState<
    "hadir" | "sakit" | "izin" | "alpa"
  >("hadir");
  const [hardwareNis, setHardwareNis] = useState<string>("");
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // References
  const hardwareInputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus hardware scanner input
  useEffect(() => {
    if (activeTab === "hardware" && hardwareInputRef.current) {
      hardwareInputRef.current.focus();
    }
  }, [activeTab]);

  // Compute stats for simulation overview
  const studentsMap = useMemo(() => {
    return new Map(students.map((s) => [s.id, s]));
  }, [students]);

  // Main QR success parser
  const handleQRDecoded = (decodedText: string) => {
    // Standard decoded text should contain student identification.
    // E.g., "STD-001" or Nis. Let's find matches.
    const cleanText = decodedText.trim();

    // Find if student exists by ID or NIS
    const matchedStudent = students.find(
      (s) => s.id === cleanText || s.nis === cleanText,
    );

    if (!matchedStudent) {
      const res = {
        success: false,
        message: `Kode QR tidak dikenal: "${cleanText}"`,
      };
      setScanResult(res);
      if (!isAudioMuted) playBeep(false);
      return;
    }

    // Call app parent register attendance handler (by default 'hadir' via standard scan)
    const registerResponse = onAttendanceSuccess(
      matchedStudent.id,
      "qr",
      "hadir",
    );
    setScanResult({
      success: registerResponse.success,
      message: registerResponse.message,
      name: registerResponse.studentName,
      parentPhone: registerResponse.parentPhone,
    });
    if (!isAudioMuted) playBeep(registerResponse.success);

    // Auto clear alert results after 4 seconds
    setTimeout(() => {
      setScanResult((prev) => {
        if (prev && prev.name === matchedStudent.name) return null;
        return prev;
      });
    }, 4000);
  };

  // Manual submission using NIS or student ID
  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualNis.trim()) return;

    const matched = students.find(
      (s) => s.nis === manualNis.trim() || s.id === manualNis.trim(),
    );
    if (!matched) {
      setScanResult({
        success: false,
        message: `Siswa dengan NIS "${manualNis}" tidak ditemukan!`,
      });
      if (!isAudioMuted) playBeep(false);
      return;
    }

    const res = onAttendanceSuccess(matched.id, "manual", manualStatus);
    setScanResult({
      success: res.success,
      message: res.message,
      name: res.studentName,
      parentPhone: res.parentPhone,
    });
    if (!isAudioMuted) playBeep(res.success);
    setManualNis("");

    setTimeout(() => setScanResult(null), 4000);
  };

  // Hardware scanner submission
  const handleHardwareSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!hardwareNis.trim()) return;

    handleQRDecoded(hardwareNis.trim());
    setHardwareNis(""); // Clear for next scan

    // Keep focus
    setTimeout(() => {
      if (hardwareInputRef.current) {
        hardwareInputRef.current.focus();
      }
    }, 10);
  };

  return (
    <div
      id="qr-scanner-root"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Left panel: Scanning Zone */}
      <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
            <div>
              <h4 className="text-base font-bold text-gray-900">
                Pemindaian QR Kehadiran
              </h4>
              <p className="text-xs text-gray-500">
                Pilih metode scan atau verifikasi manual siswa
              </p>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className={`p-2 rounded-lg border transition-colors ${
                isAudioMuted
                  ? "bg-red-50 border-red-100 text-red-500"
                  : "bg-purple-50 border-purple-100 text-purple-600"
              }`}
              title={
                isAudioMuted ? "Aktifkan Suara Beep" : "Senapkan Suara Beep"
              }
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>

          {/* Verification Method Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mb-6 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab("hardware");
              }}
              className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors ${
                activeTab === "hardware"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <ScanLine className="h-4 w-4" />
              <span className="hidden sm:inline">Scanner</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("manual");
              }}
              className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors ${
                activeTab === "manual"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Keyboard className="h-4 w-4" />
              <span className="hidden sm:inline">Keypad</span>
            </button>
          </div>

          {/* TAB 3: Hardware Scanner */}
          {activeTab === "hardware" && (
            <div className="space-y-4">
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl h-[240px] flex flex-col items-center justify-center p-6 text-center">
                <ScanLine className="h-10 w-10 text-blue-600 mb-3 stroke-1" />
                <h5 className="font-semibold text-gray-800 text-sm">
                  Alat Scanner Aktif
                </h5>
                <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed mb-4">
                  Arahkan kursor ke dalam kotak di bawah ini, lalu scan barcode
                  kartu siswa.
                </p>
                <form
                  onSubmit={handleHardwareSubmit}
                  className="w-full max-w-[200px]"
                >
                  <input
                    ref={hardwareInputRef}
                    type="text"
                    value={hardwareNis}
                    onChange={(e) => setHardwareNis(e.target.value)}
                    placeholder="Scan di sini..."
                    className="w-full bg-white border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-center text-sm font-bold text-gray-800 outline-none transition-all shadow-inner"
                    autoFocus
                  />
                  {/* Hidden submit to handle enter natively */}
                  <button type="submit" className="hidden">
                    Submit
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: Manual NIS Keypad Entry */}
          {activeTab === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Pilih Status Absensi
                    </label>
                    <select
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="hadir">Hadir (Present)</option>
                      <option value="sakit">Sakit (Sick)</option>
                      <option value="izin">Izin (Permitted)</option>
                      <option value="alpa">Alpa (Absent)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Nomor Induk Siswa (NIS)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 21001"
                      value={manualNis}
                      onChange={(e) => setManualNis(e.target.value)}
                      className="w-full bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                </div>

                {/* Digital Virtual Keypad */}
                <div className="pt-2">
                  <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center mb-2">
                    Keypad Numerik
                  </span>
                  <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                    {[
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "0",
                      "Hapus",
                      "OK",
                    ].map((key) => {
                      if (key === "Hapus") {
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setManualNis((prev) => prev.slice(0, -1))
                            }
                            className="py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg text-xs transition-colors"
                          >
                            ⌫
                          </button>
                        );
                      }
                      if (key === "OK") {
                        return (
                          <button
                            key={key}
                            type="submit"
                            className="py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-colors"
                          >
                            Verif
                          </button>
                        );
                      }
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setManualNis((prev) => prev + key)}
                          className="py-2.5 bg-white border border-gray-200 hover:bg-gray-100 font-mono font-bold text-gray-800 rounded-lg text-sm transition-colors shadow-2xs"
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Scan Status Alerts */}
        {scanResult && (
          <div
            className={`mt-5 p-4 rounded-xl border flex items-start gap-3 transition-all duration-300 ${
              scanResult.success
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : "bg-red-50 border-red-100 text-red-800"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {scanResult.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div className="text-xs">
              <span className="block font-bold text-sm">
                {scanResult.success ? "ABSEN BERHASIL" : "ABSEN GAGAL"}
              </span>
              <p className="mt-0.5 leading-relaxed font-medium">
                {scanResult.message}
              </p>
              {scanResult.success && scanResult.name && (
                <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="text-[10px] text-emerald-600 font-mono uppercase tracking-wider">
                    Siswa: {scanResult.name} | Waktu:{" "}
                    {new Date().toLocaleTimeString("id-ID")}
                  </p>
                  {scanResult.parentPhone && (
                    <a
                      href={`https://wa.me/${scanResult.parentPhone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=Halo%20Bapak/Ibu,%20${encodeURIComponent(scanResult.name)}%20baru%20saja%20melakukan%20absensi%20pada%20${encodeURIComponent(new Date().toLocaleTimeString("id-ID"))}.`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-3 h-3"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      Kirim WA
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: Recent Scan Log Live stream */}
      <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
        <div>
          <h4 className="text-base font-bold text-gray-900 mb-1">
            Riwayat Pindai Terkini
          </h4>
          <p className="text-xs text-gray-500 mb-4">
            Daftar siswa yang baru saja terverifikasi tap QR hari ini
          </p>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {records.filter(
              (r) =>
                new Date(r.timestamp).toDateString() ===
                new Date().toDateString(),
            ).length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 text-center">
                <div className="p-3 bg-gray-50 rounded-full mb-2">
                  <ScanLine className="h-6 w-6 stroke-1 text-gray-400" />
                </div>
                <p className="text-xs">
                  Belum ada aktivitas pindai QR hari ini
                </p>
              </div>
            ) : (
              records
                .filter(
                  (r) =>
                    new Date(r.timestamp).toDateString() ===
                    new Date().toDateString(),
                )
                // Sort latest first
                .sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime(),
                )
                .slice(0, 5)
                .map((r) => {
                  const s = studentsMap.get(r.studentId);
                  return (
                    <div
                      key={r.id}
                      className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between hover:bg-gray-100/40 transition-colors"
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-gray-800 text-xs truncate">
                          {r.studentName}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          NIS: {s?.nis || "-"} • {r.className}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {r.status}
                        </span>
                        <div className="text-[9px] text-gray-400 font-mono mt-1">
                          {new Date(r.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4 text-[11px] text-gray-400 leading-relaxed">
          💡 <strong>Ketentuan Jam Masuk:</strong> Pastikan siswa memindai kode
          QR pada rentang jam absen sekolah yang telah disepakati untuk
          menghindari kalkulasi keterlambatan.
        </div>
      </div>
    </div>
  );
}
