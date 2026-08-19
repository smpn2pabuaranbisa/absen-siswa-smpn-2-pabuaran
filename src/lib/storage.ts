// Safe IndexedDB and localStorage persistent offline storage manager
// Prevents QuotaExceededError when storing large datasets, student photos, or extensive attendance logs.

import { Student, AttendanceRecord, AttendanceConfig, CalendarEvent } from '../types';

const DB_NAME = 'AbsensiQR_OfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_keyval';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.warn('IndexedDB open error, falling back to safe local storage:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result !== undefined ? (req.result as T) : null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    return null;
  }
}

export async function idbSet<T>(key: string, val: T): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

export async function idbDelete(key: string): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Safe localStorage setter that never throws QuotaExceededError.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[safeLocalStorageSet] Storage quota reached or restricted when setting "${key}". Safely handled.`, err);
    // If quota exceeded, attempt to clear non-critical caches if needed
    try {
      // If setting students/records, don't crash, let IndexedDB and Firestore take primary persistence
      if (key === 'absensi_qr_students') {
        // Try storing a version without heavy base64 photos to fit under 5MB quota
        try {
          const parsed = JSON.parse(value) as Student[];
          const lightweight = parsed.map(s => {
            if (s.photo && s.photo.length > 500) {
              return { ...s, photo: undefined };
            }
            return s;
          });
          localStorage.setItem(key, JSON.stringify(lightweight));
          return true;
        } catch {
          // If still fails, silently skip localStorage write
        }
      } else if (key === 'absensi_qr_records') {
        // Store only the most recent 150 records in localStorage fallback
        try {
          const parsed = JSON.parse(value) as AttendanceRecord[];
          const trimmed = parsed.slice(0, 150);
          localStorage.setItem(key, JSON.stringify(trimmed));
          return true;
        } catch {
          // Skip localStorage write
        }
      }
    } catch {
      // Ignore inner catch
    }
    return false;
  }
}

export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[safeLocalStorageGet] Failed to read "${key}"`, err);
    return null;
  }
}

export function safeLocalStorageRemove(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    return false;
  }
}

// Student Persistence with IndexedDB and safe localStorage backup
export async function saveStudentsLocal(students: Student[]): Promise<void> {
  // 1. Save full data (including photos) to IndexedDB
  await idbSet('absensi_qr_students', students);

  // 2. Save safe fallback to localStorage (stripping heavy photo base64 if needed)
  try {
    const lightweight = students.map(s => {
      if (s.photo && s.photo.startsWith('data:image')) {
        return { ...s, photo: undefined };
      }
      return s;
    });
    safeLocalStorageSet('absensi_qr_students', JSON.stringify(lightweight));
  } catch (err) {
    console.warn('Failed to backup students to localStorage:', err);
  }
}

export async function loadStudentsLocal(): Promise<Student[] | null> {
  // 1. Try IndexedDB first
  const fromIDB = await idbGet<Student[]>('absensi_qr_students');
  if (fromIDB && Array.isArray(fromIDB) && fromIDB.length > 0) {
    return fromIDB;
  }

  // 2. Fallback to localStorage
  const fromLS = safeLocalStorageGet('absensi_qr_students');
  if (fromLS) {
    try {
      const parsed = JSON.parse(fromLS);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse students from localStorage:', e);
    }
  }

  return null;
}

// Records Persistence
export async function saveRecordsLocal(records: AttendanceRecord[]): Promise<void> {
  await idbSet('absensi_qr_records', records);
  const trimmed = records.slice(0, 150);
  safeLocalStorageSet('absensi_qr_records', JSON.stringify(trimmed));
}

export async function loadRecordsLocal(): Promise<AttendanceRecord[] | null> {
  const fromIDB = await idbGet<AttendanceRecord[]>('absensi_qr_records');
  if (fromIDB && Array.isArray(fromIDB) && fromIDB.length > 0) {
    return fromIDB;
  }

  const fromLS = safeLocalStorageGet('absensi_qr_records');
  if (fromLS) {
    try {
      const parsed = JSON.parse(fromLS);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse records from localStorage:', e);
    }
  }

  return null;
}

// Config Persistence
export async function saveConfigLocal(config: AttendanceConfig): Promise<void> {
  await idbSet('absensi_qr_config', config);
  safeLocalStorageSet('absensi_qr_config', JSON.stringify(config));
}

export async function loadConfigLocal(): Promise<AttendanceConfig | null> {
  const fromIDB = await idbGet<AttendanceConfig>('absensi_qr_config');
  if (fromIDB) return fromIDB;

  const fromLS = safeLocalStorageGet('absensi_qr_config');
  if (fromLS) {
    try {
      return JSON.parse(fromLS);
    } catch (e) {
      console.error('Failed to parse config from localStorage:', e);
    }
  }

  return null;
}

// Events Persistence
export async function saveEventsLocal(events: CalendarEvent[]): Promise<void> {
  await idbSet('absensi_qr_events', events);
  safeLocalStorageSet('absensi_qr_events', JSON.stringify(events));
}

export async function loadEventsLocal(): Promise<CalendarEvent[] | null> {
  const fromIDB = await idbGet<CalendarEvent[]>('absensi_qr_events');
  if (fromIDB && Array.isArray(fromIDB)) return fromIDB;

  const fromLS = safeLocalStorageGet('absensi_qr_events');
  if (fromLS) {
    try {
      return JSON.parse(fromLS);
    } catch (e) {
      console.error('Failed to parse events from localStorage:', e);
    }
  }

  return null;
}

/**
 * Compresses an image file or data URI to a max dimension and quality to avoid heavy payload bloat.
 */
export function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processImage = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const isPng = (typeof fileOrDataUrl !== 'string' && fileOrDataUrl.type === 'image/png') ||
                    (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/png'));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outputType = isPng ? 'image/png' : 'image/jpeg';
      const resultDataUrl = canvas.toDataURL(outputType, quality);
      resolve(resultDataUrl);
    };

    img.onload = processImage;
    img.onerror = () => {
      if (typeof fileOrDataUrl === 'string') resolve(fileOrDataUrl);
      else reject(new Error('Failed to load image for compression'));
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

