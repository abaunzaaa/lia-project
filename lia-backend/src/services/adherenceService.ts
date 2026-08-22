import { computeAdherence, fetchScheduledDoses } from './scheduledDoseService';
import { AdherenceSummary } from '../models/intakeTypes';
import { minDate, todayInTimeZone } from '../utils/timezone';

/**
 * Adherencia sobre dosis cuyo scheduled_for ya ocurrió (no futuras).
 */
export async function getAdherence(params: {
  userId: string;
  from: string;
  to: string;
  timezone: string;
}): Promise<AdherenceSummary> {
  const today = todayInTimeZone(params.timezone);
  const effectiveTo = minDate(params.to, today);

  if (effectiveTo < params.from) {
    return {
      totalScheduled: 0,
      taken: 0,
      skipped: 0,
      missed: 0,
      percentage: null,
    };
  }

  const rows = await fetchScheduledDoses({
    userId: params.userId,
    from: params.from,
    to: effectiveTo,
    timezone: params.timezone,
    mode: 'historical',
  });

  return computeAdherence(rows, new Date());
}
