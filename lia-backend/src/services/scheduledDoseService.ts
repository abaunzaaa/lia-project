import { pool } from '../config/database';
import {
  AdherenceSummary,
  DerivedDoseStatus,
  HistoryItem,
  IntakeStatus,
  ReminderItem,
  ScheduledDoseRow,
} from '../models/intakeTypes';

export class DoseServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'DoseServiceError';
  }
}

/** active_only: recordatorios (solo medicamentos activos).
 *  historical: historial/adherencia (incluye archivados, dosis antes de archived_at). */
export type ScheduledDoseMode = 'active_only' | 'historical';

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function deriveDoseStatus(
  scheduledFor: Date,
  intakeStatus: IntakeStatus | null,
  now: Date = new Date()
): DerivedDoseStatus {
  if (intakeStatus === 'taken') return 'taken';
  if (intakeStatus === 'skipped') return 'skipped';
  if (scheduledFor.getTime() <= now.getTime()) return 'missed';
  return 'pending';
}

export function reminderId(scheduleId: string, date: string): string {
  return `${scheduleId}:${date}`;
}

function mapRow(row: ScheduledDoseRow): ScheduledDoseRow {
  return {
    ...row,
    scheduled_for:
      row.scheduled_for instanceof Date
        ? row.scheduled_for
        : new Date(row.scheduled_for),
    action_at:
      row.action_at === null
        ? null
        : row.action_at instanceof Date
          ? row.action_at
          : new Date(row.action_at),
  };
}

/**
 * Genera dosis programadas en [from, to] para el usuario,
 * haciendo LEFT JOIN con medication_intakes.
 * scheduled_for se construye en PostgreSQL: (date + time_of_day) AT TIME ZONE tz
 */
export async function fetchScheduledDoses(params: {
  userId: string;
  from: string;
  to: string;
  timezone: string;
  mode: ScheduledDoseMode;
}): Promise<ScheduledDoseRow[]> {
  const { userId, from, to, timezone, mode } = params;

  const activeFilter =
    mode === 'active_only'
      ? 'AND m.is_active = true'
      : '';

  // En histórico: dosis posteriores al archivado no existen (ni como missed).
  // En activos: archived_at es NULL, esta condición no restringe.
  const archiveFilter = `
      AND (
        m.archived_at IS NULL
        OR ((d.day + s.time_of_day) AT TIME ZONE $3) < m.archived_at
      )`;

  const result = await pool.query<ScheduledDoseRow>(
    `
    WITH days AS (
      SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
    ),
    planned AS (
      SELECT
        m.id AS medication_id,
        s.id AS schedule_id,
        m.name AS medication_name,
        m.dose AS medication_dose,
        d.day::text AS dose_date,
        to_char(s.time_of_day, 'HH24:MI') AS time_hm,
        ((d.day + s.time_of_day) AT TIME ZONE $3) AS scheduled_for
      FROM days d
      INNER JOIN public.medications m
        ON m.user_id = $4
       AND (m.start_date IS NULL OR d.day >= m.start_date)
       AND (m.end_date IS NULL OR d.day <= m.end_date)
       ${activeFilter}
      INNER JOIN public.medication_schedules s
        ON s.medication_id = m.id
      WHERE (
        m.weekdays IS NULL
        OR cardinality(m.weekdays) = 0
        OR (
          CASE EXTRACT(ISODOW FROM d.day)::integer
            WHEN 1 THEN 'monday'
            WHEN 2 THEN 'tuesday'
            WHEN 3 THEN 'wednesday'
            WHEN 4 THEN 'thursday'
            WHEN 5 THEN 'friday'
            WHEN 6 THEN 'saturday'
            WHEN 7 THEN 'sunday'
          END
        ) = ANY (m.weekdays)
      )
       ${archiveFilter}
    )
    SELECT
      p.medication_id,
      p.schedule_id,
      p.medication_name,
      p.medication_dose,
      p.dose_date,
      p.time_hm,
      p.scheduled_for,
      i.id AS intake_id,
      i.status AS intake_status,
      i.action_at
    FROM planned p
    LEFT JOIN public.medication_intakes i
      ON i.user_id = $4
     AND i.medication_id = p.medication_id
     AND i.schedule_id = p.schedule_id
     AND i.scheduled_for = p.scheduled_for
    ${
      mode === 'historical'
        ? `WHERE NOT EXISTS (
             SELECT 1
             FROM public.medication_history_hides h
             WHERE h.user_id = $4
               AND h.medication_id = p.medication_id
               AND h.schedule_id = p.schedule_id
               AND h.scheduled_for = p.scheduled_for
           )`
        : ''
    }
    `,
    [from, to, timezone, userId]
  );

  return result.rows.map(mapRow);
}

export function toReminderItem(row: ScheduledDoseRow, now?: Date): ReminderItem {
  const status = deriveDoseStatus(row.scheduled_for, row.intake_status, now);
  return {
    id: reminderId(row.schedule_id, row.dose_date),
    medicationId: row.medication_id,
    scheduleId: row.schedule_id,
    medication: {
      name: row.medication_name,
      dose: row.medication_dose,
    },
    date: row.dose_date,
    time: row.time_hm,
    scheduledFor: toIso(row.scheduled_for) ?? '',
    status,
    intakeId: row.intake_id,
    actionAt: toIso(row.action_at),
  };
}

export function toHistoryItem(row: ScheduledDoseRow, now?: Date): HistoryItem {
  const status = deriveDoseStatus(row.scheduled_for, row.intake_status, now);
  return {
    medicationId: row.medication_id,
    scheduleId: row.schedule_id,
    intakeId: row.intake_id,
    medication: {
      name: row.medication_name,
      dose: row.medication_dose,
    },
    date: row.dose_date,
    time: row.time_hm,
    scheduledFor: toIso(row.scheduled_for) ?? '',
    status,
    actionAt: toIso(row.action_at),
  };
}

export function computeAdherence(rows: ScheduledDoseRow[], now: Date = new Date()): AdherenceSummary {
  const due = rows.filter((row) => row.scheduled_for.getTime() <= now.getTime());

  let taken = 0;
  let skipped = 0;
  let missed = 0;

  for (const row of due) {
    const status = deriveDoseStatus(row.scheduled_for, row.intake_status, now);
    if (status === 'taken') taken += 1;
    else if (status === 'skipped') skipped += 1;
    else if (status === 'missed') missed += 1;
  }

  const totalScheduled = due.length;
  const percentage =
    totalScheduled === 0 ? null : Math.round((taken / totalScheduled) * 100);

  return {
    totalScheduled,
    taken,
    skipped,
    missed,
    percentage,
  };
}
