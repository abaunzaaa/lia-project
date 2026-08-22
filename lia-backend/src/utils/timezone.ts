/**
 * Utilidades de zona horaria sin dependencias externas.
 * La conversión date+time → timestamptz se hace en PostgreSQL con AT TIME ZONE.
 */

/** Fecha civil actual (YYYY-MM-DD) en el timezone IANA indicado. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo calcular la fecha local del timezone.');
  }

  return `${year}-${month}-${day}`;
}

/** Devuelve el menor de dos YYYY-MM-DD. */
export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Lista inclusiva de fechas civiles YYYY-MM-DD entre from y to. */
export function eachDateInclusive(from: string, to: string): string[] {
  if (to < from) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const next = new Date(`${cursor}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return dates;
}

/** Hora local 0–23 a partir de HH:mm (horario programado del medicamento). */
export function hourFromTimeHm(timeHm: string): number {
  const hour = Number.parseInt(timeHm.slice(0, 2), 10);
  return Number.isFinite(hour) ? hour : 0;
}
