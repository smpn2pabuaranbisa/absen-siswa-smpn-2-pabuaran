import { AttendanceConfig, DailyScheduleMap, DaySchedule, WorkDayKey } from '../types';

export const WORK_DAYS: {
  key: WorkDayKey;
  label: string;
  shortLabel: string;
  jsDay: number;
}[] = [
  { key: 'senin', label: 'Senin', shortLabel: 'Sen', jsDay: 1 },
  { key: 'selasa', label: 'Selasa', shortLabel: 'Sel', jsDay: 2 },
  { key: 'rabu', label: 'Rabu', shortLabel: 'Rab', jsDay: 3 },
  { key: 'kamis', label: 'Kamis', shortLabel: 'Kam', jsDay: 4 },
  { key: 'jumat', label: 'Jumat', shortLabel: 'Jum', jsDay: 5 },
  { key: 'sabtu', label: 'Sabtu', shortLabel: 'Sab', jsDay: 6 },
];

export function isValidTimeString(val?: string): val is string {
  return typeof val === 'string' && /^\d{2}:\d{2}$/.test(val);
}

export function getDefaultDailySchedule(
  fallbackStart = '06:30',
  fallbackEnd = '07:30',
  fallbackOut = '14:00',
): DailyScheduleMap {
  const start = isValidTimeString(fallbackStart) ? fallbackStart : '06:30';
  const end = isValidTimeString(fallbackEnd) ? fallbackEnd : '07:30';
  const out = isValidTimeString(fallbackOut) ? fallbackOut : '14:00';

  return {
    senin: { enabled: true, checkInStart: start, checkInEnd: end, checkOutStart: out },
    selasa: { enabled: true, checkInStart: start, checkInEnd: end, checkOutStart: out },
    rabu: { enabled: true, checkInStart: start, checkInEnd: end, checkOutStart: out },
    kamis: { enabled: true, checkInStart: start, checkInEnd: end, checkOutStart: out },
    jumat: { enabled: true, checkInStart: start, checkInEnd: end, checkOutStart: '11:30' },
    sabtu: { enabled: true, checkInStart: start, checkInEnd: end, checkOutStart: '12:00' },
  };
}

export function getEffectiveDailySchedule(config: AttendanceConfig): DailyScheduleMap {
  const defaults = getDefaultDailySchedule(
    config.checkInStart,
    config.checkInEnd,
    config.checkOutStart || '14:00',
  );

  if (!config.dailySchedule) {
    return defaults;
  }

  const merged = { ...defaults };
  for (const day of WORK_DAYS) {
    const incoming = config.dailySchedule[day.key];
    if (incoming) {
      merged[day.key] = {
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : defaults[day.key].enabled,
        checkInStart: isValidTimeString(incoming.checkInStart)
          ? incoming.checkInStart
          : defaults[day.key].checkInStart,
        checkInEnd: isValidTimeString(incoming.checkInEnd)
          ? incoming.checkInEnd
          : defaults[day.key].checkInEnd,
        checkOutStart: isValidTimeString(incoming.checkOutStart)
          ? incoming.checkOutStart
          : defaults[day.key].checkOutStart,
      };
    }
  }
  return merged;
}

export interface DateScheduleInfo {
  isSunday: boolean;
  dayKey: WorkDayKey | null;
  dayLabel: string;
  schedule: DaySchedule | null;
}

export function getScheduleForDate(
  config: AttendanceConfig,
  date: Date = new Date(),
): DateScheduleInfo {
  const jsDay = date.getDay();
  if (jsDay === 0) {
    return {
      isSunday: true,
      dayKey: null,
      dayLabel: 'Minggu',
      schedule: null,
    };
  }

  const matched = WORK_DAYS.find((d) => d.jsDay === jsDay);
  if (!matched) {
    return {
      isSunday: true,
      dayKey: null,
      dayLabel: 'Minggu',
      schedule: null,
    };
  }

  const effective = getEffectiveDailySchedule(config);
  return {
    isSunday: false,
    dayKey: matched.key,
    dayLabel: matched.label,
    schedule: effective[matched.key],
  };
}

export function parseTimeOnDate(timeStr: string, baseDate: Date = new Date()): Date {
  const [hour, min] = timeStr.split(':').map(Number);
  const target = new Date(baseDate);
  target.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(min) ? min : 0, 0, 0);
  return target;
}

export function timeToMinutes(timeStr: string): number {
  if (!isValidTimeString(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
