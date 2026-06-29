import { useState, useEffect, useMemo } from "react";
import {
  Student,
  AttendanceRecord,
  AttendanceConfig,
  AttendanceStatus,
  StatsSummary,
  CalendarEvent,
} from "./types";
import {
  INITIAL_STUDENTS,
  INITIAL_CONFIG,
  generateMockAttendance,
} from "./data/mockData";

// Component Imports
import DashboardStats from "./components/DashboardStats";
import QRScanner from "./components/QRScanner";
import StudentList from "./components/StudentList";
import AttendanceLogs from "./components/AttendanceLogs";
import ClassConfig from "./components/ClassConfig";
import Onboarding from "./components/Onboarding";
import EduCalendar from "./components/EduCalendar";

// Firebase Imports
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./lib/firebase";

// Icons
import {
  LayoutDashboard,
  QrCode,
  Users,
  FileText,
  Settings,
  Clock,
  Sparkles,
  BookOpen,
  AlertCircle,
  CalendarDays,
  Cloud,
  CloudOff,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "scan" | "students" | "logs" | "settings" | "calendar"
  >("dashboard");

  // Core stateful databases
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [config, setConfig] = useState<AttendanceConfig>(INITIAL_CONFIG);

  // Time clock & sync state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Dynamic network state listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 1. Initial Seeding and Real-Time Firebase Synchronizer
  useEffect(() => {
    // A. Synchronously load offline localStorage fallback first for instant responsive rendering
    const storedConfig = localStorage.getItem("absensi_qr_config");
    if (storedConfig) {
      try {
        setConfig(JSON.parse(storedConfig));
      } catch (e) {
        console.error("Failed to parse config");
      }
    }
    const storedStudents = localStorage.getItem("absensi_qr_students");
    if (storedStudents) {
      try {
        setStudents(JSON.parse(storedStudents));
      } catch (e) {
        console.error("Failed to parse students");
      }
    } else {
      setStudents(INITIAL_STUDENTS);
      localStorage.setItem(
        "absensi_qr_students",
        JSON.stringify(INITIAL_STUDENTS),
      );
    }
    const storedRecords = localStorage.getItem("absensi_qr_records");
    if (storedRecords) {
      try {
        setRecords(JSON.parse(storedRecords));
      } catch (e) {
        console.error("Failed to parse records");
      }
    } else {
      const initialRecords = generateMockAttendance();
      setRecords(initialRecords);
      localStorage.setItem(
        "absensi_qr_records",
        JSON.stringify(initialRecords),
      );
    }
    const storedEvents = localStorage.getItem("absensi_qr_events");
    if (storedEvents) {
      try {
        setEvents(JSON.parse(storedEvents));
      } catch (e) {
        console.error("Failed to parse events");
      }
    } else {
      setEvents([]);
      localStorage.setItem("absensi_qr_events", JSON.stringify([]));
    }

    // B. Ensure config exists in cloud
    const checkAndSeedCloudDatabase = async () => {
      try {
        const cfgSnap = await getDoc(doc(db, "config", "global_config"));
        if (!cfgSnap.exists()) {
          const curConfig = localStorage.getItem("absensi_qr_config")
            ? JSON.parse(localStorage.getItem("absensi_qr_config")!)
            : INITIAL_CONFIG;
          await setDoc(doc(db, "config", "global_config"), curConfig);
          console.log("Cloud config initialized.");
        }
      } catch (err) {
        console.warn(
          "Unable to auto-seed cloud config:",
          err,
        );
      }
    };

    checkAndSeedCloudDatabase();

    // C. Attach live real-time listeners for instant multi-device collaborative scanning
    const unsubStudents = onSnapshot(
      collection(db, "students"),
      (snap) => {
        const list: Student[] = [];
        snap.forEach((d) => {
          list.push(d.data() as Student);
        });
        setStudents(list);
        localStorage.setItem("absensi_qr_students", JSON.stringify(list));
      },
      (err) => console.error("Error listening to students:", err),
    );

    const unsubRecords = onSnapshot(
      collection(db, "attendance_records"),
      (snap) => {
        const list: AttendanceRecord[] = [];
        snap.forEach((d) => {
          list.push(d.data() as AttendanceRecord);
        });
        // Sort records by timestamp descending
        list.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setRecords(list);
        localStorage.setItem("absensi_qr_records", JSON.stringify(list));
      },
      (err) => console.error("Error listening to records:", err),
    );

    const unsubEvents = onSnapshot(
      collection(db, "calendar_events"),
      (snap) => {
        const list: CalendarEvent[] = [];
        snap.forEach((d) => {
          list.push(d.data() as CalendarEvent);
        });
        setEvents(list);
        localStorage.setItem("absensi_qr_events", JSON.stringify(list));
      },
      (err) => console.error("Error listening to events:", err),
    );

    let configLoaded = false;

    // First try to fetch directly to avoid cache-first flashing
    getDoc(doc(db, "config", "global_config"))
      .then((snap) => {
        if (snap.exists()) {
          const cfg = snap.data() as AttendanceConfig;
          setConfig(cfg);
          localStorage.setItem("absensi_qr_config", JSON.stringify(cfg));
        }
        configLoaded = true;
        setIsLoadingConfig(false);
      })
      .catch((err) => {
        console.warn("Failed to fetch config directly:", err);
        configLoaded = true;
        setIsLoadingConfig(false);
      });

    const unsubConfig = onSnapshot(
      doc(db, "config", "global_config"),
      (snap) => {
        if (snap.exists()) {
          const cfg = snap.data() as AttendanceConfig;
          setConfig(cfg);
          localStorage.setItem("absensi_qr_config", JSON.stringify(cfg));
        }
        if (!configLoaded && !snap.metadata.fromCache) {
          setIsLoadingConfig(false);
        }
      },
      (err) => {
        console.error("Error listening to config:", err);
        setIsLoadingConfig(false);
      },
    );

    return () => {
      unsubStudents();
      unsubRecords();
      unsubEvents();
      unsubConfig();
    };
  }, []);

  const handleOnboardingComplete = (
    newConfig: Omit<AttendanceConfig, "selectedClassFilter">,
  ) => {
    const completeConfig: AttendanceConfig = {
      ...newConfig,
      selectedClassFilter: "Semua Kelas",
      isConfigured: true,
    };
    persistConfig(completeConfig);
  };

  // 2. Local Clock dynamic ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Extract unique classes for global dropdown filter
  const classList = useMemo(() => {
    const classes = new Set(students.map((s) => s.className));
    if (config.customClasses) {
      config.customClasses.forEach((c) => classes.add(c));
    }
    const sorted = Array.from(classes).sort();
    return ["Semua Kelas", ...sorted];
  }, [students, config.customClasses]);

  // Global Class filter state synced with config
  const handleClassFilterChange = (newClass: string) => {
    const updated = { ...config, selectedClassFilter: newClass };
    persistConfig(updated);
  };

  // 4. Persistence Handlers (Writes locally and coordinates with Firestore)
  const persistStudents = async (updatedStudents: Student[]) => {
    setStudents(updatedStudents);
    localStorage.setItem(
      "absensi_qr_students",
      JSON.stringify(updatedStudents),
    );
  };

  const persistRecords = async (updatedRecords: AttendanceRecord[]) => {
    setRecords(updatedRecords);
    localStorage.setItem("absensi_qr_records", JSON.stringify(updatedRecords));
  };

  const persistConfig = async (updatedConfig: AttendanceConfig) => {
    setConfig(updatedConfig);
    localStorage.setItem("absensi_qr_config", JSON.stringify(updatedConfig));
    try {
      await setDoc(doc(db, "config", "global_config"), updatedConfig);
    } catch (err) {
      console.error("Failed to update config in Firestore:", err);
    }
  };

  const persistEvents = async (updatedEvents: CalendarEvent[]) => {
    setEvents(updatedEvents);
    localStorage.setItem("absensi_qr_events", JSON.stringify(updatedEvents));
    try {
      const batch = writeBatch(db);
      // Clean old events
      const eventSnap = await getDocs(collection(db, "calendar_events"));
      eventSnap.forEach((d) => batch.delete(d.ref));
      // Set new ones
      updatedEvents.forEach((ev) => {
        batch.set(doc(db, "calendar_events", ev.id), ev);
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to sync events to Firestore:", err);
    }
  };

  // 5. Database Actions (CRUD operations synced directly with Cloud Firestore)
  const handleAddStudent = async (newS: Omit<Student, "id">) => {
    const id = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newStudent: Student = { ...newS, id };

    // Update local state instantly for extreme responsiveness
    const updated = [...students, newStudent];
    persistStudents(updated);

    try {
      await setDoc(doc(db, "students", id), newStudent);
    } catch (err) {
      console.error("Failed to add student to Firestore:", err);
    }
  };

  const handleEditStudent = async (editedS: Student) => {
    const updated = students.map((s) => (s.id === editedS.id ? editedS : s));
    persistStudents(updated);

    // Sync names on historic logs if changed
    const updatedRecords = records.map((r) =>
      r.studentId === editedS.id
        ? { ...r, studentName: editedS.name, className: editedS.className }
        : r,
    );
    persistRecords(updatedRecords);

    try {
      await setDoc(doc(db, "students", editedS.id), editedS);

      const batch = writeBatch(db);
      records.forEach((r) => {
        if (r.studentId === editedS.id) {
          batch.set(doc(db, "attendance_records", r.id), {
            ...r,
            studentName: editedS.name,
            className: editedS.className,
          });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to edit student in Firestore:", err);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    persistStudents(updated);

    // Wipe attendance of deleted student
    const updatedRecords = records.filter((r) => r.studentId !== id);
    persistRecords(updatedRecords);

    try {
      await deleteDoc(doc(db, "students", id));

      const batch = writeBatch(db);
      records.forEach((r) => {
        if (r.studentId === id) {
          batch.delete(doc(db, "attendance_records", r.id));
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to delete student from Firestore:", err);
    }
  };

  const handleBulkImport = async (importedList: Omit<Student, "id">[]) => {
    const formatted: Student[] = importedList.map((item, index) => ({
      ...item,
      id: `STD-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
    }));
    const updated = [...students, ...formatted];
    persistStudents(updated);

    try {
      const batch = writeBatch(db);
      formatted.forEach((s) => {
        batch.set(doc(db, "students", s.id), s);
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to bulk import students to Firestore:", err);
    }
  };

  // Attendance Records actions
  const handleAttendanceSuccess = (
    studentId: string,
    verifiedBy: "qr" | "manual",
    customStatus: AttendanceStatus = "hadir",
  ): {
    success: boolean;
    message: string;
    studentName?: string;
    parentPhone?: string;
  } => {
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return {
        success: false,
        message: "Data siswa tidak ditemukan di database!",
      };
    }

    const todayStr = new Date().toDateString();

    // Check if already scanned today
    const alreadyScanned = records.find((r) => {
      const isToday = new Date(r.timestamp).toDateString() === todayStr;
      return r.studentId === studentId && isToday;
    });

    if (alreadyScanned) {
      return {
        success: false,
        message: `Siswa "${student.name}" sudah melakukan absensi hari ini pada jam ${new Date(alreadyScanned.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}!`,
      };
    }

    // Determine status (Hadir/Terlambat or Custom specified)
    let statusToRecord: AttendanceStatus = customStatus;
    let note: string | undefined = undefined;

    if (verifiedBy === "qr") {
      // Compare time against limit (CheckInEnd)
      const now = new Date();
      const [limitHour, limitMin] = config.checkInEnd.split(":").map(Number);
      const limitTime = new Date();
      limitTime.setHours(limitHour, limitMin, 0, 0);

      if (now > limitTime) {
        statusToRecord = "hadir";
        note = "Terlambat (Pindai QR)";
      } else {
        statusToRecord = "hadir";
        note = "Tepat Waktu (Pindai QR)";
      }
    }

    const newRecordId = `REC-${Date.now()}-${studentId}`;
    const newRecord: AttendanceRecord = {
      id: newRecordId,
      studentId: studentId,
      studentName: student.name,
      className: student.className,
      timestamp: new Date().toISOString(),
      status: statusToRecord,
      verifiedBy,
      notes: note,
    };

    persistRecords([newRecord, ...records]);

    // Push directly to Firestore (automatic offline queuing)
    setDoc(doc(db, "attendance_records", newRecordId), newRecord).catch((err) =>
      console.error("Failed to sync new record to Firestore:", err),
    );

    // Auto Send WhatsApp
    if (config.waAutoSend && student.parentPhone) {
      const waPhone = student.parentPhone.replace(/[^0-9]/g, "");
      if (waPhone) {
        const timeStr = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const waMessage = `Halo Bapak/Ibu,\n\nAnak Anda, *${student.name}* (Kelas ${student.className}), telah tercatat *${statusToRecord.toUpperCase()}* pada pukul *${timeStr}*.\n\nTerima kasih,\n${config.schoolName}`;

        const provider = config.waProvider || "fonnte";

        if (provider === "fonnte" && config.waApiToken) {
          // Fonnte API request
          fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: {
              Authorization: config.waApiToken,
            },
            body: new URLSearchParams({
              target: waPhone,
              message: waMessage,
              countryCode: "62",
            }),
          }).catch((err) =>
            console.error("Gagal mengirim pesan WA Fonnte:", err),
          );
        } else if (provider === "custom" && config.waApiUrl) {
          // Custom API request
          try {
            let headers = { "Content-Type": "application/json" };
            if (config.waApiHeaders) {
              try {
                headers = { ...headers, ...JSON.parse(config.waApiHeaders) };
              } catch (e) {
                console.error("Format WA API Headers tidak valid (harus JSON)");
              }
            }

            let payloadTemplate =
              config.waApiPayload ||
              '{"target": "{{phone}}", "message": "{{message}}"}';
            // Simple replace, using stringify for message to escape quotes/newlines
            const bodyPayload = payloadTemplate
              .replace(/\{\{phone\}\}/g, waPhone)
              .replace(/"\{\{message\}\}"/g, JSON.stringify(waMessage));

            fetch(config.waApiUrl, {
              method: "POST",
              headers,
              body: bodyPayload,
            }).catch((err) =>
              console.error("Gagal mengirim pesan WA Custom:", err),
            );
          } catch (e) {
            console.error("Gagal menyiapkan request WA Custom", e);
          }
        }
      }
    }

    return {
      success: true,
      message: `${student.name} berhasil diabsen [${statusToRecord.toUpperCase()}]!`,
      studentName: student.name,
      parentPhone: student.parentPhone,
    };
  };

  const handleUpdateRecord = async (
    recordId: string,
    updatedStatus: AttendanceStatus,
    notes?: string,
  ) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    const updatedRecord = {
      ...record,
      status: updatedStatus,
      notes: notes || undefined,
    };
    const updated = records.map((r) => (r.id === recordId ? updatedRecord : r));
    persistRecords(updated);

    try {
      await setDoc(doc(db, "attendance_records", recordId), updatedRecord);
    } catch (err) {
      console.error("Failed to update record in Firestore:", err);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    const updated = records.filter((r) => r.id !== recordId);
    persistRecords(updated);

    try {
      await deleteDoc(doc(db, "attendance_records", recordId));
    } catch (err) {
      console.error("Failed to delete record from Firestore:", err);
    }
  };

  const handleAddManualRecord = async (
    studentId: string,
    status: AttendanceStatus,
    dateISOString: string,
    notes?: string,
  ) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const recordId = `REC-${Date.now()}-${studentId}`;
    const newRecord: AttendanceRecord = {
      id: recordId,
      studentId: studentId,
      studentName: student.name,
      className: student.className,
      timestamp: dateISOString,
      status,
      verifiedBy: "manual",
      notes: notes || "Input manual guru",
    };

    const updated = [newRecord, ...records];
    persistRecords(updated);

    try {
      await setDoc(doc(db, "attendance_records", recordId), newRecord);
    } catch (err) {
      console.error("Failed to add manual record in Firestore:", err);
    }
  };

  // Database center resets
  const handleResetDatabase = async () => {
    persistStudents([]);
    persistRecords([]);
    persistEvents([]);
    persistConfig(INITIAL_CONFIG);

    try {
      const batch = writeBatch(db);

      const studentSnap = await getDocs(collection(db, "students"));
      studentSnap.forEach((d) => batch.delete(d.ref));

      const recordSnap = await getDocs(collection(db, "attendance_records"));
      recordSnap.forEach((d) => batch.delete(d.ref));

      const eventSnap = await getDocs(collection(db, "calendar_events"));
      eventSnap.forEach((d) => batch.delete(d.ref));

      batch.set(doc(db, "config", "global_config"), INITIAL_CONFIG);

      await batch.commit();
    } catch (err) {
      console.error("Failed to reset cloud database:", err);
    }
  };

  const handleRestoreDatabase = async (
    restoredStudents: Student[],
    restoredRecords: AttendanceRecord[],
    restoredConfig: AttendanceConfig,
  ) => {
    persistStudents(restoredStudents);
    persistRecords(restoredRecords);
    persistConfig(restoredConfig);

    try {
      const batch = writeBatch(db);

      const studentSnap = await getDocs(collection(db, "students"));
      studentSnap.forEach((d) => batch.delete(d.ref));

      const recordSnap = await getDocs(collection(db, "attendance_records"));
      recordSnap.forEach((d) => batch.delete(d.ref));

      restoredStudents.forEach((st) => {
        batch.set(doc(db, "students", st.id), st);
      });

      restoredRecords.forEach((rec) => {
        batch.set(doc(db, "attendance_records", rec.id), rec);
      });

      batch.set(doc(db, "config", "global_config"), restoredConfig);

      await batch.commit();
    } catch (err) {
      console.error("Failed to restore cloud database:", err);
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <QrCode className="h-6 w-6 text-indigo-600 absolute animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mb-2">
            SMPN 2 PABUARAN
          </h2>
          <p className="text-sm text-slate-500 font-bold mb-1">
            Menghubungkan ke Database Cloud...
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            Sistem sedang sinkronisasi data online-first
          </p>
        </div>
      </div>
    );
  }

  if (!config.isConfigured) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div
      id="app-root"
      className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col"
    >
      {/* HEADER BAR */}
      <header
        id="app-header"
        className="bg-white border-b border-gray-100 shadow-2xs sticky top-0 z-40"
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-xl" />
            ) : (
              <div className="h-10 w-10 bg-gradient-to-tr from-purple-700 to-indigo-800 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
                <QrCode className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-base font-black text-gray-900 tracking-tight">
                {config.schoolName}
              </h1>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-600 animate-pulse" />{" "}
                SISTEM ABSENSI BARCODE
              </p>
            </div>
          </div>

          {/* Right Header: Dynamic clock & Firebase status & Global class filter */}
          <div className="flex items-center space-x-4">
            {/* Real-time Clock */}
            <div className="hidden md:flex items-center space-x-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl font-mono text-xs text-gray-600">
              <Clock className="h-3.5 w-3.5 text-purple-600" />
              <span>
                {currentTime.toLocaleDateString("id-ID", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span className="font-bold text-gray-900">
                {currentTime.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>

            {/* Firebase Sync Status */}
            <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100/50 px-3 py-1.5 rounded-xl text-[11px]">
              {isOnline ? (
                <>
                  <Cloud className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                  <span className="text-indigo-800 font-bold sm:block hidden">
                    Sinkron Cloud Aktif
                  </span>
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                    title="Online & Terhubung"
                  ></span>
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500 font-bold sm:block hidden">
                    Mode Offline-First
                  </span>
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber-500"
                    title="Offline (Menggunakan Cache Lokal)"
                  ></span>
                </>
              )}
            </div>

            {/* Global Class Scope selector */}
            <div className="flex items-center space-x-1 bg-purple-50/70 border border-purple-100/50 px-2.5 py-1 rounded-xl">
              <label className="text-[10px] font-bold text-purple-700 uppercase tracking-wider hidden sm:block">
                Scope Kelas:
              </label>
              <select
                value={config.selectedClassFilter}
                onChange={(e) => handleClassFilterChange(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-purple-800 outline-none cursor-pointer pr-1"
              >
                {classList.map((c) => (
                  <option
                    key={c}
                    value={c}
                    className="bg-white text-slate-800 font-semibold"
                  >
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col lg:flex-row gap-6">
        {/* SIDEBAR NAVIGATION - Sticky on desktop */}
        <aside
          id="app-sidebar"
          className="lg:w-[240px] shrink-0 self-start lg:sticky lg:top-22 space-y-2"
        >
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full px-4 py-3 rounded-2xl font-semibold text-xs flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-purple-700 text-white shadow-xs font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("scan")}
            className={`w-full px-4 py-3 rounded-2xl font-semibold text-xs flex items-center justify-between transition-all cursor-pointer ${
              activeTab === "scan"
                ? "bg-purple-700 text-white shadow-xs font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <QrCode className="h-4.5 w-4.5" />
              <span>Pemindaian QR</span>
            </div>
            <span className="text-[9px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded-full uppercase animate-pulse">
              Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab("students")}
            className={`w-full px-4 py-3 rounded-2xl font-semibold text-xs flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "students"
                ? "bg-purple-700 text-white shadow-xs font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <Users className="h-4.5 w-4.5" />
            <span>
              Data Siswa (
              {
                students.filter(
                  (s) =>
                    config.selectedClassFilter === "Semua Kelas" ||
                    s.className === config.selectedClassFilter,
                ).length
              }
              )
            </span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full px-4 py-3 rounded-2xl font-semibold text-xs flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-purple-700 text-white shadow-xs font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <FileText className="h-4.5 w-4.5" />
            <span>Jurnal Absensi</span>
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`w-full px-4 py-3 rounded-2xl font-semibold text-xs flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "calendar"
                ? "bg-purple-700 text-white shadow-xs font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <CalendarDays className="h-4.5 w-4.5" />
            <span>Kalender Pendidikan</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full px-4 py-3 rounded-2xl font-semibold text-xs flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-purple-700 text-white shadow-xs font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <Settings className="h-4.5 w-4.5" />
            <span>Pengaturan</span>
          </button>
        </aside>

        {/* ACTIVE MAIN CONTENT VIEW */}
        <main id="app-main-view" className="flex-1 min-w-0">
          {activeTab === "dashboard" && (
            <DashboardStats
              students={students}
              records={records}
              activeClass={config.selectedClassFilter}
            />
          )}

          {activeTab === "scan" && (
            <QRScanner
              students={students}
              records={records}
              onAttendanceSuccess={handleAttendanceSuccess}
            />
          )}

          {activeTab === "students" && (
            <StudentList
              students={students}
              onAddStudent={handleAddStudent}
              onEditStudent={handleEditStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkImport={handleBulkImport}
              activeClass={config.selectedClassFilter}
              schoolName={config.schoolName}
              logoUrl={config.logoUrl}
              customClasses={config.customClasses}
              config={config}
              onUpdateConfig={persistConfig}
            />
          )}

          {activeTab === "logs" && (
            <AttendanceLogs
              students={students}
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              onAddManualRecord={handleAddManualRecord}
              activeClass={config.selectedClassFilter}
              config={config}
            />
          )}

          {activeTab === "calendar" && (
            <EduCalendar events={events} onUpdateEvents={persistEvents} />
          )}

          {activeTab === "settings" && (
            <ClassConfig
              config={config}
              onUpdateConfig={persistConfig}
              students={students}
              records={records}
              onResetDatabase={handleResetDatabase}
              onRestoreDatabase={handleRestoreDatabase}
            />
          )}
        </main>
      </div>

      {/* FOOTER BAR */}
      <footer
        id="app-footer"
        className="bg-white border-t border-gray-100 py-4 mt-auto"
      >
        <div className="max-w-[1440px] mx-auto px-4 lg:px-10 text-center text-xs text-gray-400 font-medium">
          © {new Date().getFullYear()} {config.schoolName} — Aplikasi Absensi
          Verifikasi Kode QR Siswa. Dikembangkan Mandiri Offline-First.
        </div>
      </footer>
    </div>
  );
}
