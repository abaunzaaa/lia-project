import { formatTime, toHHmm } from './helpers';
import { getLocalDateString } from './dateTime';

export const DOSE_UNITS = [
  'mg',
  'g',
  'mcg',
  'mL',
  'tableta',
  'tabletas',
  'cápsula',
  'cápsulas',
  'gotas',
  'unidades',
  'sobre',
  'otro',
] as const;

export type DoseUnitOption = (typeof DOSE_UNITS)[number];

/** Unidades de conteo: dosis = cuántas unidades por toma (dropdown 1–5). */
export const COUNT_DOSE_UNITS: DoseUnitOption[] = [
  'tableta',
  'tabletas',
  'cápsula',
  'cápsulas',
  'sobre',
];

export function isCountDoseUnit(unit: DoseUnitOption): boolean {
  return COUNT_DOSE_UNITS.includes(unit);
}

export function unitSingularLabel(unit: DoseUnitOption): string {
  switch (unit) {
    case 'tableta':
    case 'tabletas':
      return 'tabletas';
    case 'cápsula':
    case 'cápsulas':
      return 'cápsulas';
    case 'sobre':
      return 'sobres';
    default:
      return unit;
  }
}

export function intakePromptForUnit(unit: DoseUnitOption): string {
  switch (unit) {
    case 'tableta':
    case 'tabletas':
      return '¿Cuántas tabletas tomas cada vez?';
    case 'cápsula':
    case 'cápsulas':
      return '¿Cuántas cápsulas tomas cada vez?';
    case 'sobre':
      return '¿Cuántos sobres tomas cada vez?';
    default:
      return '¿Cuántas unidades tomas cada vez?';
  }
}

/**
 * Días inclusivos entre start y end (YYYY-MM-DD).
 * Devuelve 0 si fechas inválidas o end < start.
 */
export function inclusiveDaySpan(startYmd: string, endYmd: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) {
    return 0;
  }
  if (endYmd < startYmd) return 0;
  const [ys, ms, ds] = startYmd.split('-').map((n) => parseInt(n, 10));
  const [ye, me, de] = endYmd.split('-').map((n) => parseInt(n, 10));
  const start = Date.UTC(ys, ms - 1, ds);
  const end = Date.UTC(ye, me - 1, de);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Stock mínimo estimado: días × tomas/día × unidades por toma.
 */
export function estimatedStockNeeded(opts: {
  startYmd: string;
  endYmd: string;
  dosesPerDay: number;
  unitsPerIntake: number;
}): number {
  const days = inclusiveDaySpan(opts.startYmd, opts.endYmd);
  if (days <= 0 || opts.dosesPerDay <= 0 || opts.unitsPerIntake <= 0) return 0;
  return days * opts.dosesPerDay * opts.unitsPerIntake;
}

export type FreqMode = 'once' | 'twice' | 'thrice' | 'interval' | 'custom';

export const FREQ_MODE_OPTIONS: { id: FreqMode; label: string }[] = [
  { id: 'once', label: '1 vez al día' },
  { id: 'twice', label: '2 veces al día' },
  { id: 'thrice', label: '3 veces al día' },
  { id: 'interval', label: 'Cada ciertas horas' },
  { id: 'custom', label: 'Horario personalizado' },
];

export const INTERVAL_OPTIONS = [
  { hours: 4, label: '4 horas', frequency: 'Cada 4 horas' },
  { hours: 6, label: '6 horas', frequency: 'Cada 6 horas' },
  { hours: 8, label: '8 horas', frequency: '8h' },
  { hours: 12, label: '12 horas', frequency: '12h' },
] as const;

export type TimeParts12 = {
  hour12: number; // 1-12
  minute: number; // 0-59
  period: 'am' | 'pm';
};

export function hhmmToParts(hhmm: string): TimeParts12 {
  const n = toHHmm(hhmm) || '08:00';
  const [hStr, mStr] = n.split(':');
  let h = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10) || 0;
  const period: 'am' | 'pm' = h >= 12 ? 'pm' : 'am';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

export function partsToHhmm(parts: TimeParts12): string {
  let h = parts.hour12 % 12;
  if (parts.period === 'pm') h += 12;
  if (parts.period === 'am' && parts.hour12 === 12) h = 0;
  if (parts.period === 'pm' && parts.hour12 === 12) h = 12;
  const m = Math.min(59, Math.max(0, Math.round(parts.minute)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const KNOWN_UNITS = DOSE_UNITS.filter((u) => u !== 'otro');

/** Best-effort: "50 mg" → { amount: "50", unit: "mg" }. */
export function parseDoseString(dose: string): {
  amount: string;
  unit: DoseUnitOption;
  customUnit: string;
} {
  const raw = dose.trim();
  if (!raw) {
    return { amount: '', unit: 'mg', customUnit: '' };
  }

  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(.+)$/i);
  if (!match) {
    return { amount: '', unit: 'otro', customUnit: raw };
  }

  const amount = match[1].replace(',', '.');
  const rest = match[2].trim();
  const lower = rest.toLowerCase();

  const known = KNOWN_UNITS.find((u) => u.toLowerCase() === lower);
  if (known) {
    return { amount, unit: known, customUnit: '' };
  }

  // Singular/plural soft match
  const soft: Record<string, DoseUnitOption> = {
    tabletas: 'tabletas',
    tableta: 'tableta',
    capsula: 'cápsula',
    cápsula: 'cápsula',
    capsulas: 'cápsulas',
    cápsulas: 'cápsulas',
    ml: 'mL',
    mililitros: 'mL',
    miligramos: 'mg',
    gramos: 'g',
    gota: 'gotas',
  };
  if (soft[lower]) {
    return { amount, unit: soft[lower], customUnit: '' };
  }

  return { amount, unit: 'otro', customUnit: rest };
}

export function buildDoseString(
  amount: string,
  unit: DoseUnitOption,
  customUnit: string
): string {
  const a = amount.trim().replace(',', '.');
  if (!a) return '';
  if (unit === 'otro') {
    const u = customUnit.trim();
    return u ? `${a} ${u}` : a;
  }
  return `${a} ${unit}`;
}

export function frequencyFromMode(
  mode: FreqMode,
  intervalHours: number
): string {
  switch (mode) {
    case 'once':
      return '24h';
    case 'twice':
      return '2x';
    case 'thrice':
      return '3x';
    case 'interval': {
      const opt = INTERVAL_OPTIONS.find((o) => o.hours === intervalHours);
      return opt?.frequency ?? `Cada ${intervalHours} horas`;
    }
    case 'custom':
    default:
      return 'Personalizado';
  }
}

export function modeFromFrequency(frequency: string): {
  mode: FreqMode;
  intervalHours: number;
} {
  const f = (frequency || '').trim();
  if (f === '24h' || f === '1 vez al día') return { mode: 'once', intervalHours: 8 };
  if (f === '2x' || f === 'Dos veces al día' || f === '2 veces al día') {
    return { mode: 'twice', intervalHours: 8 };
  }
  if (f === '3x' || f === 'Tres veces al día' || f === '3 veces al día') {
    return { mode: 'thrice', intervalHours: 8 };
  }
  if (f === '8h' || f === 'Cada 8 horas') return { mode: 'interval', intervalHours: 8 };
  if (f === '12h' || f === 'Cada 12 horas') return { mode: 'interval', intervalHours: 12 };
  if (f === 'Cada 4 horas') return { mode: 'interval', intervalHours: 4 };
  if (f === 'Cada 6 horas') return { mode: 'interval', intervalHours: 6 };
  if (f === 'Personalizado' || f === 'prn') return { mode: 'custom', intervalHours: 8 };
  return { mode: 'custom', intervalHours: 8 };
}

/**
 * Genera horarios en el mismo día local a partir de una hora inicial + intervalo.
 * No cruza a la madrugada siguiente.
 */
export function generateSameDayTimes(startHhmm: string, intervalHours: number): string[] {
  const start = toHHmm(startHhmm);
  if (!start || intervalHours <= 0) return start ? [start] : [];
  const [h0, m0] = start.split(':').map((n) => parseInt(n, 10));
  const startMinutes = h0 * 60 + m0;
  const result: string[] = [];
  for (let t = startMinutes; t < 24 * 60; t += intervalHours * 60) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    result.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return result.length ? result : [start];
}

export function defaultTimesForMode(mode: FreqMode, intervalHours: number): string[] {
  switch (mode) {
    case 'once':
      return ['08:00'];
    case 'twice':
      return ['08:00', '20:00'];
    case 'thrice':
      return ['08:00', '14:00', '20:00'];
    case 'interval':
      return generateSameDayTimes('08:00', intervalHours);
    case 'custom':
    default:
      return ['08:00'];
  }
}

export function formatShortDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function todayYmd(): string {
  return getLocalDateString();
}

export function summarizeSchedules(times: string[]): string {
  return times.map((t) => formatTime(t)).join(' · ');
}

export const MINUTE_PRESETS = [0, 15, 30, 45] as const;

export type MedicationPresentation =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'drops'
  | 'sachet';

export type MealRelation = 'before_meal' | 'after_meal' | 'with_meal';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const FORM_DOSE_UNITS = [
  'mg',
  'g',
  'mcg',
  'ml',
  'gotas',
  'unidades',
  'tabletas',
  'cápsulas',
  'otra',
] as const;

export type FormDoseUnit = (typeof FORM_DOSE_UNITS)[number];

export const PRESENTATION_OPTIONS: {
  id: MedicationPresentation;
  label: string;
}[] = [
  { id: 'tablet', label: 'Tableta' },
  { id: 'capsule', label: 'Cápsula' },
  { id: 'liquid', label: 'Líquido' },
  { id: 'drops', label: 'Gotas' },
  { id: 'sachet', label: 'Sobre' },
];

/** Unidades típicas de esa presentación. Tabletas/cápsulas también se recetan en mg o g. */
export function unitsForPresentation(presentation: MedicationPresentation | null): FormDoseUnit[] {
  switch (presentation) {
    case 'tablet':
      return ['mg', 'g', 'mcg', 'tabletas', 'otra'];
    case 'capsule':
      return ['mg', 'g', 'mcg', 'cápsulas', 'otra'];
    case 'liquid':
      return ['ml', 'otra'];
    case 'drops':
      return ['gotas', 'ml', 'otra'];
    case 'sachet':
      return ['g', 'mg', 'unidades', 'otra'];
    default:
      return [...FORM_DOSE_UNITS];
  }
}

export function doseUnitForPresentation(presentation: MedicationPresentation): FormDoseUnit {
  switch (presentation) {
    case 'tablet':
    case 'capsule':
      return 'mg';
    case 'liquid':
      return 'ml';
    case 'drops':
      return 'gotas';
    case 'sachet':
      return 'unidades';
    default:
      return 'mg';
  }
}

export function formDoseUnitLabel(unit: FormDoseUnit): string {
  switch (unit) {
    case 'mg':
      return 'miligramos (mg)';
    case 'g':
      return 'gramos (g)';
    case 'mcg':
      return 'microgramos (mcg)';
    case 'ml':
      return 'mililitros (ml)';
    case 'gotas':
      return 'gotas';
    case 'unidades':
      return 'unidades';
    case 'tabletas':
      return 'tabletas';
    case 'cápsulas':
      return 'cápsulas';
    case 'otra':
      return 'otra';
    default:
      return unit;
  }
}

export function formDoseUnitShort(unit: FormDoseUnit, customUnit?: string): string {
  if (unit === 'otra') return customUnit?.trim() || 'otra';
  return unit;
}

/** Cuántas unidades hay en casa, según la presentación (no la dosis en mg). */
export function stockUnitForPresentation(presentation: MedicationPresentation | null): string {
  switch (presentation) {
    case 'tablet':
      return 'tabletas';
    case 'capsule':
      return 'cápsulas';
    case 'liquid':
      return 'ml';
    case 'drops':
      return 'gotas';
    case 'sachet':
      return 'sobres';
    default:
      return 'unidades';
  }
}

export const MEAL_OPTIONS: { id: MealRelation; label: string }[] = [
  { id: 'before_meal', label: 'Antes de comer' },
  { id: 'after_meal', label: 'Después de comer' },
  { id: 'with_meal', label: 'Con la comida' },
];

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const WEEKDAY_LETTER: Record<Weekday, string> = {
  monday: 'L',
  tuesday: 'M',
  wednesday: 'M',
  thursday: 'J',
  friday: 'V',
  saturday: 'S',
  sunday: 'D',
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const ALL_WEEKDAYS: Weekday[] = [...WEEKDAYS];

export function presentationLabel(value?: MedicationPresentation | null): string {
  if (!value) return '';
  return PRESENTATION_OPTIONS.find((item) => item.id === value)?.label ?? '';
}

export function mealLabel(value?: MealRelation | null): string {
  if (!value) return '';
  return MEAL_OPTIONS.find((item) => item.id === value)?.label ?? '';
}

export function weekdayFromYmd(ymd: string): Weekday {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const jsDay = new Date(y, m - 1, d).getDay();
  const map: Weekday[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return map[jsDay] ?? 'monday';
}

export function formatWeekdaysPhrase(days: Weekday[]): string {
  const ordered = WEEKDAYS.filter((day) => days.includes(day));
  if (ordered.length === 0) return '';
  if (ordered.length === 7) return 'Todos los días';
  const weekdaySet = new Set(ordered);
  if (
    ordered.length === 5 &&
    weekdaySet.has('monday') &&
    weekdaySet.has('tuesday') &&
    weekdaySet.has('wednesday') &&
    weekdaySet.has('thursday') &&
    weekdaySet.has('friday')
  ) {
    return 'Lunes a viernes';
  }
  const labels = ordered.map((day) => WEEKDAY_LABEL[day]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

export function formatTimesPhrase(times: string[]): string {
  const labels = times.map((time) => formatTime(time));
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

export function formatScheduleSummary(params: {
  weekdays: Weekday[];
  times: string[];
  mealRelation?: MealRelation | null;
}): string {
  const parts = [
    formatWeekdaysPhrase(params.weekdays),
    formatTimesPhrase(params.times),
    mealLabel(params.mealRelation),
  ].filter(Boolean);
  return parts.join(' · ');
}

export function parseDoseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function toFormDoseUnit(unit: DoseUnitOption | string): FormDoseUnit {
  const lower = unit.toLowerCase();
  if (lower === 'ml' || lower === 'ml') return 'ml';
  if (lower === 'mcg' || lower === 'ug' || lower === 'µg') return 'mcg';
  if (lower === 'tableta' || lower === 'tabletas') return 'tabletas';
  if (lower === 'cápsula' || lower === 'capsula' || lower === 'cápsulas' || lower === 'capsulas') {
    return 'cápsulas';
  }
  if (lower === 'mg' || lower === 'g' || lower === 'gotas' || lower === 'unidades') {
    return lower as FormDoseUnit;
  }
  if (lower === 'otro' || lower === 'otra' || lower === 'sobre') return 'otra';
  return 'mg';
}

export function nextAvailableTime(existing: string[]): string {
  const candidates = ['08:00', '12:00', '14:00', '18:00', '20:00', '22:00', '09:00', '16:00'];
  const pick = candidates.find((time) => !existing.includes(time));
  if (pick) return pick;
  for (let hour = 7; hour <= 22; hour += 1) {
    const time = `${String(hour).padStart(2, '0')}:00`;
    if (!existing.includes(time)) return time;
  }
  return '08:30';
}

export const MAX_SCHEDULE_TIMES = 8;
export const MAX_MEDICATION_NAME = 160;
export const MAX_PURPOSE = 240;
export const MAX_INSTRUCTIONS = 2000;
