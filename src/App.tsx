import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { getScheduleForDate, parseTimeOnDate } from "./lib/schedule";

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
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import { db } from "./lib/firebase";
import {
  saveStudentsLocal,
  loadStudentsLocal,
  saveRecordsLocal,
  loadRecordsLocal,
  saveConfigLocal,
  loadConfigLocal,
  saveEventsLocal,
  loadEventsLocal,
  safeLocalStorageGet,
  safeLocalStorageSet,
} from "./lib/storage";

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
  RefreshCw,
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
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs for race-free merging in async listeners & loaders
  const recordsRef = useRef<AttendanceRecord[]>([]);
  const studentsRef = useRef<Student[]>([]);
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  const isSyncingStudentsRef = useRef(false);
  const isSyncingEventsRef = useRef(false);

  // Bounded cutoff: earlier of (start of current month) and (7 days ago)
  const recentCutoffISO = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const cutoff = startOfMonth.getTime() < sevenDaysAgo.getTime() ? startOfMonth : sevenDaysAgo;
    return cutoff.toISOString();
  }, []);

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

  const isQuotaError = (err: unknown) => {
    const code = (err as { code?: string })?.code || "";
    const msg = err instanceof Error ? err.message : String(err || "");
    return (
      code === "resource-exhausted" ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("resource-exhausted")
    );
  };

  const handleFirestoreListenError = useCallback((label: string, err: unknown) => {
    if (isQuotaError(err)) {
      setIsQuotaExceeded(true);
      console.warn(`Firestore daily quota reached (${label}), running in local offline-first mode.`);
    } else {
      console.error(`Error listening to ${label}:`, err);
    }
  }, []);

  const syncStudentsFromCloud = useCallback(async (expectedVersion?: number) => {
    if (isSyncingStudentsRef.current) return;
    isSyncingStudentsRef.current = true;
    try {
      const snap = await getDocs(collection(db, "students"));
      setIsQuotaExceeded(false);
      const list: Student[] = [];
      snap.forEach((d) => {
        list.push(d.data() as Student);
      });
      studentsRef.current = list;
      setStudents(list);
      await saveStudentsLocal(list);
      const verToSave = expectedVersion && expectedVersion > 0 ? expectedVersion : 1;
      safeLocalStorageSet("absensi_qr_students_version", String(verToSave));
    } catch (err) {
      handleFirestoreListenError("students", err);
    } finally {
      isSyncingStudentsRef.current = false;
    }
  }, [handleFirestoreListenError]);

  const syncEventsFromCloud = useCallback(async (expectedVersion?: number) => {
    if (isSyncingEventsRef.current) return;
    isSyncingEventsRef.current = true;
    try {
      const snap = await getDocs(collection(db, "calendar_events"));
      setIsQuotaExceeded(false);
      const list: CalendarEvent[] = [];
      snap.forEach((d) => {
        list.push(d.data() as CalendarEvent);
      });
      setEvents(list);
      await saveEventsLocal(list);
      const verToSave = expectedVersion && expectedVersion > 0 ? expectedVersion : 1;
      safeLocalStorageSet("absensi_qr_events_version", String(verToSave));
    } catch (err) {
      handleFirestoreListenError("events", err);
    } finally {
      isSyncingEventsRef.current = false;
    }
  }, [handleFirestoreListenError]);

  const ensureMonthLoaded = useCallback(
    async (year: number, month: number, force = false) => {
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const startDate = new Date(year, month, 1, 0, 0, 0, 0);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      // Current active range is already kept live by onSnapshot
      if (startISO >= recentCutoffISO && !force) {
        return;
      }

      if (loadedMonthsRef.current.has(monthKey) && !force) {
        return;
      }

      setIsLoadingHistory(true);
      try {
        const monthQuery = query(
          collection(db, "attendance_records"),
          where("timestamp", ">=", startISO),
          where("timestamp", "<=", endISO),
        );
        const snap = await getDocs(monthQuery);
        setIsQuotaExceeded(false);

        const fetched: AttendanceRecord[] = [];
        snap.forEach((d) => {
          fetched.push(d.data() as AttendanceRecord);
        });

        const baseRecords =
          recordsRef.current.length > 0
            ? recordsRef.current
            : (await loadRecordsLocal()) || [];

        const outsideRange = baseRecords.filter(
          (r) => r.timestamp < startISO || r.timestamp > endISO,
        );
        const mergedMap = new Map<string, AttendanceRecord>();
        outsideRange.forEach((r) => mergedMap.set(r.id, r));
        fetched.forEach((r) => mergedMap.set(r.id, r));

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        recordsRef.current = merged;
        setRecords(merged);
        await saveRecordsLocal(merged);
        loadedMonthsRef.current.add(monthKey);
      } catch (err) {
        handleFirestoreListenError(`records (${monthKey})`, err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [recentCutoffISO, handleFirestoreListenError],
  );

  // 1. Initial Seeding and Optimized Firebase Synchronizer
  useEffect(() => {
    let seededCloudConfig = false;

    // A. Asynchronously load local offline storage first for instant responsive rendering
    const loadInitialLocalData = async () => {
      try {
        const storedConfig = await loadConfigLocal();
        if (storedConfig) {
          setConfig(storedConfig);
          if (storedConfig.isConfigured) {
            setIsLoadingConfig(false);
          }
        }

        const storedStudents = await loadStudentsLocal();
        if (storedStudents && storedStudents.length > 0) {
          studentsRef.current = storedStudents;
          setStudents(storedStudents);
        } else {
          studentsRef.current = INITIAL_STUDENTS;
          setStudents(INITIAL_STUDENTS);
          saveStudentsLocal(INITIAL_STUDENTS);
        }

        const storedRecords = await loadRecordsLocal();
        if (storedRecords && storedRecords.length > 0) {
          recordsRef.current = storedRecords;
          setRecords(storedRecords);
        } else {
          const initialRecords = generateMockAttendance();
          recordsRef.current = initialRecords;
          setRecords(initialRecords);
          saveRecordsLocal(initialRecords);
        }

        const storedEvents = await loadEventsLocal();
        if (storedEvents) {
          setEvents(storedEvents);
        } else {
          setEvents([]);
          saveEventsLocal([]);
        }
      } catch (err) {
        console.warn("Local storage loading warning:", err);
      }
    };

    loadInitialLocalData();

    // B. Bounded real-time listener: ONLY listen to recent attendance records (>= recentCutoffISO)
    // Older months are loaded on-demand when requested in Jurnal Absensi, saving massive read quota!
    const recentRecordsQuery = query(
      collection(db, "attendance_records"),
      where("timestamp", ">=", recentCutoffISO),
    );

    const unsubRecords = onSnapshot(
      recentRecordsQuery,
      async (snap) => {
        if (!snap.metadata.fromCache) setIsQuotaExceeded(false);
        if (snap.empty && snap.metadata.fromCache) return;

        const recentList: AttendanceRecord[] = [];
        snap.forEach((d) => {
          recentList.push(d.data() as AttendanceRecord);
        });

        const baseRecords =
          recordsRef.current.length > 0
            ? recordsRef.current
            : (await loadRecordsLocal()) || [];

        // Keep cached records older than recentCutoffISO, replace recent window with live snapshot
        const olderCached = baseRecords.filter(
          (r) => r.timestamp < recentCutoffISO,
        );
        const mergedMap = new Map<string, AttendanceRecord>();
        olderCached.forEach((r) => mergedMap.set(r.id, r));
        recentList.forEach((r) => mergedMap.set(r.id, r));

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        recordsRef.current = merged;
        setRecords(merged);
        saveRecordsLocal(merged);
      },
      (err) => handleFirestoreListenError("records", err),
    );

    // C. Single config listener (1 doc) drives version-checked cache-first sync for students & events
    const unsubConfig = onSnapshot(
      doc(db, "config", "global_config"),
      async (snap) => {
        const fromCache = snap.metadata.fromCache;
        if (!fromCache) setIsQuotaExceeded(false);

        if (snap.exists()) {
          const cfg = snap.data() as AttendanceConfig;
          setConfig(cfg);
          saveConfigLocal(cfg);

          if (!fromCache) {
            // Check if students need syncing from cloud
            const localStudentsVer = Number(
              safeLocalStorageGet("absensi_qr_students_version") || "0",
            );
            const remoteStudentsVer = cfg.studentsVersion || 0;
            const localStudentsList =
              studentsRef.current.length > 0
                ? studentsRef.current
                : (await loadStudentsLocal()) || [];
            const hasLocalStudents = localStudentsList.length > 0;

            if (
              !hasLocalStudents ||
              remoteStudentsVer > localStudentsVer ||
              (remoteStudentsVer === 0 && localStudentsVer === 0)
            ) {
              syncStudentsFromCloud(remoteStudentsVer);
            }

            // Check if calendar events need syncing from cloud
            const localEventsVer = Number(
              safeLocalStorageGet("absensi_qr_events_version") || "0",
            );
            const remoteEventsVer = cfg.eventsVersion || 0;
            if (
              remoteEventsVer > localEventsVer ||
              (remoteEventsVer === 0 && localEventsVer === 0)
            ) {
              syncEventsFromCloud(remoteEventsVer);
            }
          }
        } else if (!fromCache && !seededCloudConfig) {
          seededCloudConfig = true;
          try {
            const curConfig = (await loadConfigLocal()) || INITIAL_CONFIG;
            await setDoc(doc(db, "config", "global_config"), curConfig);
          } catch (seedErr) {
            if (isQuotaError(seedErr)) {
              setIsQuotaExceeded(true);
            }
            console.warn("Unable to auto-seed cloud config:", seedErr);
          }
        }
        setIsLoadingConfig(false);
      },
      (err) => {
        handleFirestoreListenError("config", err);
        setIsLoadingConfig(false);
      },
    );

    return () => {
      unsubRecords();
      unsubConfig();
    };
  }, [
    recentCutoffISO,
    handleFirestoreListenError,
    syncStudentsFromCloud,
    syncEventsFromCloud,
  ]);

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
    studentsRef.current = updatedStudents;
    setStudents(updatedStudents);
    await saveStudentsLocal(updatedStudents);
  };

  const persistRecords = async (updatedRecords: AttendanceRecord[]) => {
    recordsRef.current = updatedRecords;
    setRecords(updatedRecords);
    await saveRecordsLocal(updatedRecords);
  };

  const persistConfig = async (updatedConfig: AttendanceConfig) => {
    setConfig(updatedConfig);
    await saveConfigLocal(updatedConfig);
    try {
      await setDoc(doc(db, "config", "global_config"), updatedConfig);
    } catch (err) {
      handleFirestoreListenError("config write", err);
    }
  };

  const bumpStudentsVersion = async () => {
    const nextVer = Date.now();
    safeLocalStorageSet("absensi_qr_students_version", String(nextVer));
    const updatedCfg = { ...config, studentsVersion: nextVer };
    setConfig(updatedCfg);
    await saveConfigLocal(updatedCfg);
    try {
      await setDoc(
        doc(db, "config", "global_config"),
        { studentsVersion: nextVer },
        { merge: true },
      );
    } catch (err) {
      handleFirestoreListenError("students version", err);
    }
  };

  const bumpEventsVersion = async () => {
    const nextVer = Date.now();
    safeLocalStorageSet("absensi_qr_events_version", String(nextVer));
    const updatedCfg = { ...config, eventsVersion: nextVer };
    setConfig(updatedCfg);
    await saveConfigLocal(updatedCfg);
    try {
      await setDoc(
        doc(db, "config", "global_config"),
        { eventsVersion: nextVer },
        { merge: true },
      );
    } catch (err) {
      handleFirestoreListenError("events version", err);
    }
  };

  const handleForceSync = async () => {
    if (!isOnline || isSyncingManual) return;
    setIsSyncingManual(true);
    try {
      await Promise.all([
        syncStudentsFromCloud(config.studentsVersion || Date.now()),
        syncEventsFromCloud(config.eventsVersion || Date.now()),
      ]);
    } finally {
      setIsSyncingManual(false);
    }
  };

  const persistEvents = async (updatedEvents: CalendarEvent[]) => {
    setEvents(updatedEvents);
    await saveEventsLocal(updatedEvents);
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
      await bumpEventsVersion();
    } catch (err) {
      handleFirestoreListenError("events write", err);
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
      await bumpStudentsVersion();
    } catch (err) {
      handleFirestoreListenError("add student", err);
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

      const affectedRecords = records.filter((r) => r.studentId === editedS.id);
      for (let i = 0; i < affectedRecords.length; i += 450) {
        const chunk = affectedRecords.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((r) => {
          batch.set(doc(db, "attendance_records", r.id), {
            ...r,
            studentName: editedS.name,
            className: editedS.className,
          });
        });
        await batch.commit();
      }
      await bumpStudentsVersion();
    } catch (err) {
      handleFirestoreListenError("edit student", err);
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

      const affectedRecords = records.filter((r) => r.studentId === id);
      for (let i = 0; i < affectedRecords.length; i += 450) {
        const chunk = affectedRecords.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((r) => {
          batch.delete(doc(db, "attendance_records", r.id));
        });
        await batch.commit();
      }
      await bumpStudentsVersion();
    } catch (err) {
      handleFirestoreListenError("delete student", err);
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
      for (let i = 0; i < formatted.length; i += 450) {
        const chunk = formatted.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((s) => {
          batch.set(doc(db, "students", s.id), s);
        });
        await batch.commit();
      }
      await bumpStudentsVersion();
    } catch (err) {
      handleFirestoreListenError("bulk import", err);
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
    type?: 'datang' | 'pulang';
  } => {
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return {
        success: false,
        message: "Data siswa tidak ditemukan di database!",
      };
    }

    const todayStr = new Date().toDateString();

    const todayRecords = records.filter((r) => {
      const isToday = new Date(r.timestamp).toDateString() === todayStr;
      return r.studentId === studentId && isToday;
    });

    const datangRecord = todayRecords.find(r => r.type === 'datang' || !r.type);
    const pulangRecord = todayRecords.find(r => r.type === 'pulang');

    let scanType: 'datang' | 'pulang' = 'datang';

    const now = new Date();
    const todayInfo = getScheduleForDate(config, now);
    const hasActiveDaySchedule = Boolean(
      !todayInfo.isSunday && todayInfo.schedule && todayInfo.schedule.enabled,
    );

    if (datangRecord && pulangRecord) {
      return {
        success: false,
        message: `Siswa "${student.name}" sudah menyelesaikan absen datang dan pulang hari ini!`,
      };
    } else if (datangRecord) {
      const timeDiff = now.getTime() - new Date(datangRecord.timestamp).getTime();

      if (
        hasActiveDaySchedule &&
        todayInfo.schedule &&
        (verifiedBy === "qr" || customStatus === "hadir")
      ) {
        const checkOutLimit = parseTimeOnDate(
          todayInfo.schedule.checkOutStart,
          now,
        );
        if (now < checkOutLimit) {
          return {
            success: false,
            message: `Belum waktunya pulang. Jam pulang hari ${todayInfo.dayLabel} pukul ${todayInfo.schedule.checkOutStart}.`,
          };
        }
      } else if (timeDiff < 60 * 1000) {
        return {
          success: false,
          message: `Siswa "${student.name}" baru saja absen datang. Silakan tunggu sebentar sebelum absen pulang.`,
        };
      }
      scanType = "pulang";
    }

    // Determine status (Hadir/Terlambat or Custom specified)
    let statusToRecord: AttendanceStatus = customStatus;
    let note: string | undefined = undefined;

    if (verifiedBy === "qr") {
      if (scanType === "datang") {
        if (hasActiveDaySchedule && todayInfo.schedule) {
          const limitTime = parseTimeOnDate(
            todayInfo.schedule.checkInEnd,
            now,
          );
          if (now > limitTime) {
            statusToRecord = "hadir";
            note = "Terlambat (Pindai QR)";
          } else {
            statusToRecord = "hadir";
            note = "Tepat Waktu (Pindai QR)";
          }
        } else {
          // Minggu atau hari yang ditandai libur: scanner tetap buka
          statusToRecord = "hadir";
          note = "Tepat Waktu (Pindai QR)";
        }
      } else {
        statusToRecord = "hadir";
        note = "Absen Pulang (Pindai QR)";
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
      type: scanType,
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
        const activityStr = scanType === 'pulang' ? 'absen pulang' : 'absen datang';
        const waMessage = `Halo Bapak/Ibu,\n\nAnak Anda, *${student.name}* (Kelas ${student.className}), telah tercatat melakukan *${activityStr}* dengan status *${statusToRecord.toUpperCase()}* pada pukul *${timeStr}*.\n\nTerima kasih,\n${config.schoolName}`;

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
      message: `${student.name} berhasil diabsen ${scanType === 'pulang' ? 'pulang' : 'datang'} [${statusToRecord.toUpperCase()}]!`,
      studentName: student.name,
      parentPhone: student.parentPhone,
      type: scanType,
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
    const nextVer = Date.now();
    const resetConfig: AttendanceConfig = {
      ...INITIAL_CONFIG,
      studentsVersion: nextVer,
      eventsVersion: nextVer,
    };
    safeLocalStorageSet("absensi_qr_students_version", String(nextVer));
    safeLocalStorageSet("absensi_qr_events_version", String(nextVer));
    loadedMonthsRef.current.clear();

    persistStudents([]);
    persistRecords([]);
    persistEvents([]);
    persistConfig(resetConfig);

    try {
      const batch = writeBatch(db);

      const studentSnap = await getDocs(collection(db, "students"));
      studentSnap.forEach((d) => batch.delete(d.ref));

      const recordSnap = await getDocs(collection(db, "attendance_records"));
      recordSnap.forEach((d) => batch.delete(d.ref));

      const eventSnap = await getDocs(collection(db, "calendar_events"));
      eventSnap.forEach((d) => batch.delete(d.ref));

      batch.set(doc(db, "config", "global_config"), resetConfig);

      await batch.commit();
    } catch (err) {
      handleFirestoreListenError("reset database", err);
    }
  };

  const handleRestoreDatabase = async (
    restoredStudents: Student[],
    restoredRecords: AttendanceRecord[],
    restoredConfig: AttendanceConfig,
  ) => {
    const nextVer = Date.now();
    const versionedConfig: AttendanceConfig = {
      ...restoredConfig,
      studentsVersion: nextVer,
      eventsVersion: nextVer,
    };
    safeLocalStorageSet("absensi_qr_students_version", String(nextVer));
    safeLocalStorageSet("absensi_qr_events_version", String(nextVer));
    loadedMonthsRef.current.clear();

    persistStudents(restoredStudents);
    persistRecords(restoredRecords);
    persistConfig(versionedConfig);

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

      batch.set(doc(db, "config", "global_config"), versionedConfig);

      await batch.commit();
    } catch (err) {
      handleFirestoreListenError("restore database", err);
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

            {/* Firebase Sync Status & Manual Pull */}
            <button
              type="button"
              onClick={handleForceSync}
              disabled={!isOnline || isSyncingManual}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] border transition-colors cursor-pointer disabled:cursor-default ${
                isQuotaExceeded
                  ? "bg-amber-50 border-amber-200/70 hover:bg-amber-100/70"
                  : "bg-indigo-50 border-indigo-100/50 hover:bg-indigo-100/60"
              }`}
              title={
                isQuotaExceeded
                  ? "Kuota baca harian Firestore tercapai. Data tetap tersimpan secara lokal. Klik untuk coba sinkron ulang."
                  : isOnline
                    ? "Online · Klik untuk sinkronisasi manual data siswa & kalender"
                    : "Offline (Menggunakan Cache Lokal)"
              }
            >
              {isSyncingManual ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-indigo-600 animate-spin" />
                  <span className="text-indigo-800 font-bold sm:block hidden">
                    Menyinkronkan...
                  </span>
                </>
              ) : isQuotaExceeded ? (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800 font-bold sm:block hidden">
                    Mode Lokal (Kuota Cloud Penuh)
                  </span>
                </>
              ) : isOnline ? (
                <>
                  <Cloud className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-indigo-800 font-bold sm:block hidden">
                    Sinkron Hemat Aktif
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500 font-bold sm:block hidden">
                    Mode Offline-First
                  </span>
                </>
              )}
            </button>

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
              config={config}
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
              onEnsureMonthLoaded={ensureMonthLoaded}
              isLoadingHistory={isLoadingHistory}
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
