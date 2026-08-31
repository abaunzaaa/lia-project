import { fetchScheduledDoses, toHistoryItem, DoseServiceError } from './scheduledDoseService';
import { HistoryItem } from '../models/intakeTypes';
import { minDate, todayInTimeZone } from '../utils/timezone';
import { pool } from '../config/database';

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

/**
 * Quita una ocurrencia del historial. No archiva el medicamento ni cancela horarios.
 */
export async function hideHistoryDose(params: {
  userId: string;
  medicationId: string;
  scheduleId: string;
  date: string;
  timezone: string;
}): Promise<void> {
  const { userId, medicationId, scheduleId, date, timezone } = params;

  const owned = await pool.query<{ scheduled_for: Date }>(
    `
    SELECT (($1::date + s.time_of_day) AT TIME ZONE $2) AS scheduled_for
    FROM public.medication_schedules s
    INNER JOIN public.medications m
      ON m.id = s.medication_id
    WHERE s.id = $3
      AND m.id = $4
      AND m.user_id = $5
    LIMIT 1
    `,
    [date, timezone, scheduleId, medicationId, userId]
  );

  const row = owned.rows[0];
  if (!row) {
    throw new DoseServiceError(404, 'No encontramos esa toma en tu historial.');
  }

  await pool.query(
    `
    INSERT INTO public.medication_history_hides (
      user_id, medication_id, schedule_id, scheduled_for
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, medication_id, schedule_id, scheduled_for)
    DO NOTHING
    `,
    [userId, medicationId, scheduleId, row.scheduled_for]
  );
}

