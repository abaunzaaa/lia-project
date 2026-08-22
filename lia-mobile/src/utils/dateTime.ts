/**
 * Helpers de fecha/hora locales para LÍA.
 * Evita bugs UTC (toISOString().split('T')[0] cerca de medianoche).
 */

const FALLBACK_TIMEZONE = 'America/Bogota';

/**
 * Timezone IANA del dispositivo (Expo Go compatible, sin deps).
 * Fallback documentado: America/Bogota si Intl no expone timeZone.
 */
export function getDeviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === 'string' && tz.length > 0) {
      return tz;
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_TIMEZONE;
}

/**
 * YYYY-MM-DD según el calendario LOCAL del dispositivo (no UTC).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Suma/resta días a una fecha local YYYY-MM-DD. */
export function addLocalDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getLocalDateString(dt);
}

/** Rango inclusivo: últimos `days` días hasta hoy local (from = hoy - (days-1)). */
export function getLocalDateRange(days: number): { from: string; to: string } {
  const to = getLocalDateString();
  const from = addLocalDays(to, -(Math.max(1, days) - 1));
  return { from, to };
}

/** Alias claro para APIs. */
export function formatDateForApi(date: Date = new Date()): string {
  return getLocalDateString(date);
}

/**
 * Muestra HH:mm o ISO time en formato local amigable (8:00 a. m.).
 * Reutiliza la misma lógica visual que helpers.formatTime.
 */
export function formatTimeForDisplay(time: string): string {
  const hhmm = extractHHmm(time);
  if (!hhmm) return time;
  const [hours, minutes] = hhmm.split(':');
  const h = parseInt(hours, 10);
  if (Number.isNaN(h)) return time;
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function extractHHmm(input: string): string | null {
  const t = input.trim();
  const fromIso = t.match(/T(\d{2}):(\d{2})/);
  if (fromIso) return `${fromIso[1]}:${fromIso[2]}`;
  const match = t.match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, '0')}:${match[2]}`;
}

/** Genera N fechas locales alrededor de hoy para el selector semanal. */
export function getLocalWeekDates(centerOffset = 0, total = 7): string[] {
  const today = getLocalDateString();
  const startOffset = centerOffset - Math.floor(total / 2);
  return Array.from({ length: total }, (_, i) => addLocalDays(today, startOffset + i));
}

/**
 * Construye un Date en hora LOCAL del dispositivo a partir de YYYY-MM-DD + HH:mm.
 * No usa offsets UTC fijos.
 */
export function localDateTimeFrom(ymd: string, hhmm: string): Date | null {
  const dateParts = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = hhmm.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!dateParts || !timeParts) return null;

  const y = parseInt(dateParts[1], 10);
  const m = parseInt(dateParts[2], 10);
  const d = parseInt(dateParts[3], 10);
  const h = parseInt(timeParts[1], 10);
  const min = parseInt(timeParts[2], 10);
  if (h > 23) return null;

  return new Date(y, m - 1, d, h, min, 0, 0);
}

/** Próximos N días locales inclusive desde hoy (hoy + N-1). */
export function getUpcomingLocalDates(days: number): string[] {
  const start = getLocalDateString();
  const count = Math.max(1, days);
  return Array.from({ length: count }, (_, i) => addLocalDays(start, i));
}
