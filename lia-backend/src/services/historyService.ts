import { fetchScheduledDoses, toHistoryItem } from './scheduledDoseService';
import { HistoryItem } from '../models/intakeTypes';
import { minDate, todayInTimeZone } from '../utils/timezone';

/**
 * Historial basado en dosis programadas (no solo intakes).
 * Limita el extremo superior a "hoy" en el timezone del usuario.
 */
export async function getHistory(params: {
  userId: string;
  from: string;
  to: string;
  timezone: string;
}): Promise<HistoryItem[]> {
  const today = todayInTimeZone(params.timezone);
  const effectiveTo = minDate(params.to, today);

  if (effectiveTo < params.from) {
    return [];
  }

  const rows = await fetchScheduledDoses({
    userId: params.userId,
    from: params.from,
    to: effectiveTo,
    timezone: params.timezone,
    mode: 'historical',
  });

  const now = new Date();
  return rows
    .map((row) => toHistoryItem(row, now))
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
}
