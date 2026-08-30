import { Ionicons } from '@expo/vector-icons';
import { DoseStatus, HistoryEntry } from '../types';
import { addLocalDays, getLocalDateString } from './dateTime';

export const HistoryPalette = {
  navy: '#245C86',
  navyDark: '#173B59',
  pastel: '#EAF5FB',
  teal: '#6FAFA7',
  coral: '#D98C7A',
  muted: '#527181',
  edge: '#DCE8EE',
  white: '#FFFFFF',
  takenBg: '#E8F4F1',
  takenFg: '#356F69',
  skippedBg: '#F8ECE8',
  skippedFg: '#9A5E50',
  missedBg: '#EAF2F7',
  missedFg: '#527181',
  pendingDot: '#A9C7D6',
  barEmpty: '#D4E4EC',
} as const;

export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export const WEEKDAY_A11Y = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

/** Navy progresivo L–D; el día actual se pinta en teal en la vista. */
export const WEEK_BAR_NAVY = [
  '#173B59',
  '#1E4F78',
  '#245C86',
  '#2F6D96',
  '#3B7CA5',
  '#4A8BB4',
  '#5A9AC0',
] as const;

export function statusCopy(status: DoseStatus): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (status) {
    case 'taken':
      return { label: 'Tomado', icon: 'checkmark' };
    case 'skipped':
      return { label: 'Omitido', icon: 'remove' };
    case 'missed':
      return { label: 'Sin registrar', icon: 'information-circle-outline' };
    default:
      return { label: 'Pendiente', icon: 'time-outline' };
  }
}

export function statusTone(status: DoseStatus, highContrast: boolean, dark: boolean, colors: {
  surface: string;
  textPrimary: string;
  surfaceElevated: string;
}): { bg: string; fg: string; badgeBg: string } {
  if (highContrast || dark) {
    return {
      bg: colors.surface,
      fg: colors.textPrimary,
      badgeBg: colors.surfaceElevated,
    };
  }
  if (status === 'taken') {
    return { bg: HistoryPalette.takenBg, fg: HistoryPalette.takenFg, badgeBg: HistoryPalette.white };
  }
  if (status === 'skipped') {
    return { bg: HistoryPalette.skippedBg, fg: HistoryPalette.skippedFg, badgeBg: HistoryPalette.white };
  }
  return { bg: HistoryPalette.missedBg, fg: HistoryPalette.missedFg, badgeBg: HistoryPalette.white };
}

export function isVisibleHistoryStatus(status: DoseStatus): boolean {
  return status === 'taken' || status === 'skipped' || status === 'missed';
}

export function formatLongDate(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDayMonth(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
}

export function formatMonthYear(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  const date = new Date(year, month - 1, day);
  const raw = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatTodayHeading(ymd: string): string {
  return `Hoy, ${formatDayMonth(ymd)}`;
}

export function startOfMonth(ymd: string): string {
  const [year, month] = ymd.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function endOfMonth(ymd: string): string {
  const [year, month] = ymd.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function addMonths(ymd: string, delta: number): string {
  const [year, month] = ymd.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return getLocalDateString(date);
}

export type MonthCell = {
  ymd: string;
  inMonth: boolean;
  isToday: boolean;
};

export function buildMonthGrid(monthYmd: string): MonthCell[] {
  const today = getLocalDateString();
  const start = startOfMonth(monthYmd);
  const [year, month, day] = start.split('-').map(Number);
  const first = new Date(year, month - 1, day);
  const weekday = first.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const gridStart = addLocalDays(start, mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const ymd = addLocalDays(gridStart, i);
    return {
      ymd,
      inMonth: ymd.slice(0, 7) === start.slice(0, 7),
      isToday: ymd === today,
    };
  });
}

export type DayDots = {
  taken: boolean;
  skipped: boolean;
  missed: boolean;
};

export function dayDotsFromEntries(entries: HistoryEntry[]): DayDots {
  let taken = false;
  let skipped = false;
  let missed = false;
  for (const entry of entries) {
    if (entry.status === 'taken') taken = true;
    else if (entry.status === 'skipped') skipped = true;
    else if (entry.status === 'missed') missed = true;
  }
  return { taken, skipped, missed };
}

export type DayProgress = {
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  total: number;
  registered: number;
  percent: number | null;
  message: string;
};

export function progressForDay(entries: HistoryEntry[]): DayProgress {
  let taken = 0;
  let skipped = 0;
  let missed = 0;
  let pending = 0;
  for (const entry of entries) {
    if (entry.status === 'taken') taken += 1;
    else if (entry.status === 'skipped') skipped += 1;
    else if (entry.status === 'missed') missed += 1;
    else pending += 1;
  }
  const total = taken + skipped + missed + pending;
  const registered = taken;
  const percent = total > 0 ? Math.round((registered / total) * 100) : null;
  let message = 'No tienes tomas registradas para hoy';
  if (total > 0 && pending + missed > 0) message = 'Tienes registros pendientes';
  else if (total > 0 && taken === total) message = 'Tus tomas de hoy';
  else if (total > 0) message = 'Revisa tus registros del día';
  return { taken, skipped, missed, pending, total, registered, percent, message };
}

export function weekdayLetters(): string[] {
  return [...WEEKDAY_LETTERS];
}

export function visibleMonthGrid(monthYmd: string): MonthCell[] {
  const cells = buildMonthGrid(monthYmd);
  let end = cells.length;
  while (end >= 7 && cells.slice(end - 7, end).every((cell) => !cell.inMonth)) {
    end -= 7;
  }
  return cells.slice(0, end);
}

export function weekDates(fromMonday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addLocalDays(fromMonday, i));
}

export function weekBarColor(index: number, isToday: boolean): string {
  if (isToday) return HistoryPalette.teal;
  return WEEK_BAR_NAVY[index] ?? HistoryPalette.navy;
}

export function startOfWeekMonday(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addLocalDays(ymd, offset);
}

export function currentWeekRange(ymd: string = getLocalDateString()): { from: string; to: string } {
  const from = startOfWeekMonday(ymd);
  return { from, to: addLocalDays(from, 6) };
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function dayAdherencePercent(taken: number, programmed: number): number | null {
  if (programmed <= 0) return null;
  return clampPercent((taken / programmed) * 100);
}

/** Un punto por día. Prioridad: omitida > sin registrar > todas tomadas. */
export function dayDotColor(entries: HistoryEntry[]): string | null {
  const visible = entries.filter((entry) => isVisibleHistoryStatus(entry.status));
  if (visible.length === 0) return null;
  if (visible.some((entry) => entry.status === 'skipped')) return HistoryPalette.coral;
  if (visible.some((entry) => entry.status === 'missed')) return HistoryPalette.pendingDot;
  if (visible.every((entry) => entry.status === 'taken')) return HistoryPalette.teal;
  return null;
}
