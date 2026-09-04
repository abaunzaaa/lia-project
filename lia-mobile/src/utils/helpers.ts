import { AccessibilityScale, AccessibilityMode } from './theme';

export function formatTime(time: string): string {
  const normalized = toHHmm(time) || time;
  const [hours, minutes] = normalized.split(':');
  const h = parseInt(hours, 10);
  if (Number.isNaN(h)) return time;
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Normaliza una hora a HH:mm (24h) para la API.
 * Acepta "8:00", "08:00", etc. Devuelve null si es inválida.
 */
export function toHHmm(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const match = t.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, '0')}:${match[2]}`;
}

/** Normaliza, ordena y deduplica horarios; lanza Error con mensaje amigable si hay inválidos. */
export function normalizeScheduleTimes(times: string[]): string[] {
  const normalized: string[] = [];
  for (const raw of times) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const hhmm = toHHmm(trimmed);
    if (!hhmm) {
      throw new Error(`El horario "${trimmed}" no es válido. Usa formato como 08:00.`);
    }
    normalized.push(hhmm);
  }
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) {
    throw new Error('No se permiten horarios duplicados.');
  }
  return unique;
}

/** Texto amigable de varios horarios para tarjetas. */
export function formatScheduleTimes(times: string[]): string {
  if (times.length === 0) return '';
  return times.map((t) => formatTime(t)).join(' · ');
}

/** Valida YYYY-MM-DD opcional. */
export function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export function getScaledFontSize(baseSize: number, mode: AccessibilityMode): number {
  return Math.round(baseSize * AccessibilityScale[mode].fontScale);
}

export function getScaledSpacing(baseSpacing: number, mode: AccessibilityMode): number {
  return Math.round(baseSpacing * AccessibilityScale[mode].spacingScale);
}

export function calculateCompliance(history: { status: string }[]): number {
  if (history.length === 0) return 100;
  const taken = history.filter((h) => h.status === 'taken').length;
  return Math.round((taken / history.length) * 100);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Normaliza nombre para comparación (minúsculas, sin acentos ni espacios extra). */
export function normalizeMedicationName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza teléfono colombiano a 10 dígitos nacionales (ej. 3001234567).
 * Acepta visualmente: 3001234567 | +57 3001234567 | 57-300-123-4567
 */
export function normalizeColombianPhone(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, '').trim();
  if (!digits) return null;

  if (digits.startsWith('+57')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('57') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (!/^\d+$/.test(digits)) return null;
  if (digits.length !== 10) return null;
  if (!digits.startsWith('3')) return null;
  return digits;
}

export function isValidColombianPhone(raw: string): boolean {
  return normalizeColombianPhone(raw) !== null;
}

/**
 * Teléfono de emergencia: colombiano (10 dígitos / +57) o internacional (8–15 dígitos, + opcional).
 */
export function normalizeEmergencyPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const colombian = normalizeColombianPhone(trimmed);
  if (colombian) return colombian;

  const stripped = trimmed.replace(/[\s\-().]/g, '');
  if (!stripped) return null;
  const plus = stripped.startsWith('+');
  const digits = plus ? stripped.slice(1) : stripped;
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return plus ? `+${digits}` : digits;
}

export function isValidEmergencyPhone(raw: string): boolean {
  return normalizeEmergencyPhone(raw) !== null;
}

/** Requisitos de contraseña alineados con registro (min 8, mayúscula, especial). */
export function passwordRequirements(password: string): {
  minLength: boolean;
  uppercase: boolean;
  special: boolean;
  ok: boolean;
} {
  const minLength = password.length >= 8;
  const uppercase = /[A-ZÁÉÍÓÚÑÜ]/.test(password);
  const special = /[^A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s]/.test(password);
  return { minLength, uppercase, special, ok: minLength && uppercase && special };
}

export function getNextDoseTime(medication: { time: string; frequency: string }): string {
  return formatTime(medication.time);
}

export const FREQUENCY_OPTIONS = [
  { label: 'Cada 8 horas', value: '8h' },
  { label: 'Cada 12 horas', value: '12h' },
  { label: 'Cada 24 horas', value: '24h' },
  { label: 'Dos veces al día', value: '2x' },
  { label: 'Tres veces al día', value: '3x' },
  { label: 'Según necesidad', value: 'prn' },
];
