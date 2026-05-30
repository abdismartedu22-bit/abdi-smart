import { startOfWeek, addDays, addWeeks, subWeeks, format } from 'date-fns';
import { id } from 'date-fns/locale';

export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
export type Hari = typeof HARI[number];

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function nextWeek(weekStart: Date): Date {
  return addWeeks(weekStart, 1);
}

export function prevWeek(weekStart: Date): Date {
  return subWeeks(weekStart, 1);
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, 'd MMM', { locale: id })} – ${format(weekEnd, 'd MMM yyyy', { locale: id })}`;
}

export function formatDayLabel(date: Date): string {
  return format(date, 'd MMM', { locale: id });
}

export function getDateForHari(weekStart: Date, hari: string): Date {
  const idx = HARI.indexOf(hari as Hari);
  return addDays(weekStart, idx === -1 ? 0 : idx);
}

export function fmtTime(t: string): string {
  return t.substring(0, 5);
}

// Bali = WITA (Waktu Indonesia Tengah) = UTC+8
export function fmtTimestampWITA(iso: string, mode: 'time' | 'short' | 'full' = 'time'): string {
  const d = new Date(iso);
  if (mode === 'time') {
    const t = d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${t} WITA`;
  }
  if (mode === 'short') {
    const s = d.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${s} WITA`;
  }
  const s = d.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${s} WITA`;
}

// Returns current time as minutes since midnight in WITA (UTC+8)
// Use this instead of setHours() so check-in windows are timezone-correct
export function nowWITAMinutes(): number {
  const now = new Date();
  const witaDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return witaDate.getUTCHours() * 60 + witaDate.getUTCMinutes();
}
