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

export function fmtTime(t: string): string {
  return t.substring(0, 5);
}
