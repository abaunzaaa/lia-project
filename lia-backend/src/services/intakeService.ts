import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { IntakeResponse, IntakeStatus } from '../models/intakeTypes';
import { DoseServiceError } from './scheduledDoseService';

interface OwnershipRow {
  medication_id: string;
  schedule_id: string;
  scheduled_for: Date;
  amount: number | null;
  units_per_intake: number;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Marca tomado/omitido de forma idempotente (UPSERT) y ajusta stock.
 * scheduled_for se construye en PostgreSQL; nunca se confía en un timestamp del cliente.
 */
export async function upsertIntake(params: {
  userId: string;
  medicationId: string;
  scheduleId: string;
  date: string;
  timezone: string;
  status: IntakeStatus;
}): Promise<IntakeResponse & { amountRemaining?: number | null }> {
  const { userId, medicationId, scheduleId, date, timezone, status } = params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ownership = await client.query<OwnershipRow>(
      `
      SELECT
        m.id AS medication_id,
        s.id AS schedule_id,
        (($1::date + s.time_of_day) AT TIME ZONE $2) AS scheduled_for,
        m.amount,
        COALESCE(m.units_per_intake, 1) AS units_per_intake
      FROM public.medication_schedules s
      INNER JOIN public.medications m
        ON m.id = s.medication_id
      WHERE s.id = $3
        AND m.id = $4
        AND m.user_id = $5
        AND (m.start_date IS NULL OR $1::date >= m.start_date)
        AND (m.end_date IS NULL OR $1::date <= m.end_date)
        AND (
          m.is_active = true
          OR (
            m.archived_at IS NOT NULL
            AND (($1::date + s.time_of_day) AT TIME ZONE $2) < m.archived_at
          )
        )
      LIMIT 1
      FOR UPDATE OF m
      `,
      [date, timezone, scheduleId, medicationId, userId]
    );

    const owned = ownership.rows[0];
    if (!owned) {
      throw new DoseServiceError(404, 'Recordatorio no encontrado.');
    }

    const scheduledFor =
      owned.scheduled_for instanceof Date
        ? owned.scheduled_for
        : new Date(owned.scheduled_for);

    const existingIntake = await client.query<{ status: IntakeStatus }>(
      `
      SELECT status
      FROM public.medication_intakes
      WHERE medication_id = $1
        AND schedule_id = $2
        AND scheduled_for = $3
      LIMIT 1
      FOR UPDATE
      `,
      [medicationId, scheduleId, scheduledFor]
    );

    const previousStatus: IntakeStatus | null = existingIntake.rows[0]?.status ?? null;

    const result = await client.query<{
      id: string;
      medication_id: string;
      schedule_id: string | null;
      scheduled_for: Date;
      status: IntakeStatus;
      action_at: Date;
    }>(
      `
      INSERT INTO public.medication_intakes (
        id, medication_id, schedule_id, user_id, scheduled_for, status, action_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW(), NOW()
      )
      ON CONFLICT (medication_id, schedule_id, scheduled_for)
      DO UPDATE SET
        status = EXCLUDED.status,
        action_at = NOW()
      RETURNING
        id,
        medication_id,
        schedule_id,
        scheduled_for,
        status,
        action_at
      `,
      [uuidv4(), medicationId, scheduleId, userId, scheduledFor, status]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DoseServiceError(500, 'No se pudo registrar la toma.');
    }

    let amountRemaining: number | null | undefined = owned.amount;
    const units = owned.units_per_intake ?? 1;

    if (owned.amount != null) {
      const deduct =
        previousStatus !== 'taken' && status === 'taken';
      const restore =
        previousStatus === 'taken' && status === 'skipped';

      if (deduct || restore) {
        const stockResult = await client.query<{ amount: number | null }>(
          `
          UPDATE public.medications
          SET
            amount = CASE
              WHEN $2::boolean THEN GREATEST(0, COALESCE(amount, 0) - $3)
              WHEN $4::boolean THEN COALESCE(amount, 0) + $3
              ELSE amount
            END,
            updated_at = NOW()
          WHERE id = $1
          RETURNING amount
          `,
          [medicationId, deduct, units, restore]
        );
        amountRemaining = stockResult.rows[0]?.amount ?? owned.amount;
      }
    }

    await client.query('COMMIT');

    return {
      id: row.id,
      medicationId: row.medication_id,
      scheduleId: row.schedule_id,
      scheduledFor: toIso(row.scheduled_for),
      status: row.status,
      actionAt: toIso(row.action_at),
      amountRemaining,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof DoseServiceError) throw error;
    console.error('[intakes:upsert]', error instanceof Error ? error.message : 'Error desconocido');
    throw new DoseServiceError(500, 'Error interno al registrar la toma.');
  } finally {
    client.release();
  }
}
