import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import {
  CreateMedicationInput,
  MedicationResponse,
  MedicationSchedule,
  UpdateMedicationInput,
} from '../models/medicationTypes';
import { stockVsEndDateError } from '../models/medicationSchemas';

export class MedicationServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'MedicationServiceError';
  }
}

interface MedicationRow {
  id: string;
  name: string;
  dose: string;
  frequency: string | null;
  amount: number | null;
  units_per_intake: number;
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
  presentation: string | null;
  dose_amount: string | number | null;
  dose_unit: string | null;
  purpose: string | null;
  weekdays: string[] | null;
  meal_relation: string | null;
  reminder_enabled: boolean;
  created_at: Date;
  updated_at: Date | null;
}

interface ScheduleRow {
  id: string;
  medication_id: string;
  time_hm: string;
}

const MEDICATION_SELECT = `
  id,
  name,
  dose,
  frequency,
  amount,
  units_per_intake,
  start_date::text AS start_date,
  end_date::text AS end_date,
  instructions,
  presentation,
  dose_amount,
  dose_unit,
  purpose,
  weekdays,
  meal_relation,
  reminder_enabled,
  created_at,
  updated_at
`;

function toIso(value: Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapMedication(
  row: MedicationRow,
  schedules: MedicationSchedule[]
): MedicationResponse {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose,
    frequency: row.frequency,
    amount: row.amount,
    unitsPerIntake: row.units_per_intake ?? 1,
    startDate: row.start_date,
    endDate: row.end_date,
    instructions: row.instructions,
    presentation: (row.presentation as MedicationResponse['presentation']) ?? null,
    doseAmount: toNumber(row.dose_amount),
    doseUnit: row.dose_unit,
    purpose: row.purpose,
    weekdays: (row.weekdays as MedicationResponse['weekdays']) ?? null,
    mealRelation: (row.meal_relation as MedicationResponse['mealRelation']) ?? null,
    reminderEnabled: row.reminder_enabled !== false,
    schedules,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at),
  };
}

/** Normaliza nombre para comparación de duplicados (trim, lower, sin acentos). */
export function normalizeMedicationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function assertNoDuplicateName(
  client: PoolClient,
  userId: string,
  name: string,
  excludeMedicationId?: string
): Promise<void> {
  const normalized = normalizeMedicationName(name);
  const result = await client.query<{ id: string; name: string }>(
    `SELECT id, name
     FROM public.medications
     WHERE user_id = $1
       AND is_active = true
       AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, excludeMedicationId ?? null]
  );

  for (const row of result.rows) {
    if (normalizeMedicationName(row.name) === normalized) {
      throw new MedicationServiceError(409, 'Este medicamento ya está registrado.');
    }
  }
}

function assertStockCoverage(params: {
  amount: number | null | undefined;
  startDate?: string | null;
  endDate?: string | null;
  scheduleTimes: string[];
  unitsPerIntake: number;
}) {
  const message = stockVsEndDateError(params);
  if (message) {
    throw new MedicationServiceError(400, message);
  }
}

async function fetchSchedules(
  client: PoolClient | typeof pool,
  medicationIds: string[]
): Promise<Map<string, MedicationSchedule[]>> {
  const map = new Map<string, MedicationSchedule[]>();
  if (medicationIds.length === 0) return map;

  const result = await client.query<ScheduleRow>(
    `SELECT
       id,
       medication_id,
       to_char(time_of_day, 'HH24:MI') AS time_hm
     FROM public.medication_schedules
     WHERE medication_id = ANY($1::uuid[])
     ORDER BY time_of_day ASC`,
    [medicationIds]
  );

  for (const row of result.rows) {
    const list = map.get(row.medication_id) ?? [];
    list.push({ id: row.id, time: row.time_hm });
    map.set(row.medication_id, list);
  }

  return map;
}

async function insertSchedules(
  client: PoolClient,
  medicationId: string,
  schedules: string[]
): Promise<void> {
  for (const time of schedules) {
    await client.query(
      `INSERT INTO public.medication_schedules (id, medication_id, time_of_day, created_at)
       VALUES ($1, $2, $3::time, NOW())`,
      [uuidv4(), medicationId, time]
    );
  }
}

function assertDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (startDate && endDate && endDate < startDate) {
    throw new MedicationServiceError(
      400,
      'La fecha final no puede ser anterior a la fecha inicial.'
    );
  }
}

export async function listMedications(userId: string): Promise<MedicationResponse[]> {
  const result = await pool.query<MedicationRow>(
    `SELECT ${MEDICATION_SELECT}
     FROM public.medications
     WHERE user_id = $1
       AND is_active = true
     ORDER BY created_at DESC`,
    [userId]
  );

  const ids = result.rows.map((row) => row.id);
  const schedulesByMed = await fetchSchedules(pool, ids);

  return result.rows.map((row) => mapMedication(row, schedulesByMed.get(row.id) ?? []));
}

export async function getMedicationById(
  userId: string,
  medicationId: string
): Promise<MedicationResponse> {
  const result = await pool.query<MedicationRow>(
    `SELECT ${MEDICATION_SELECT}
     FROM public.medications
     WHERE id = $1
       AND user_id = $2
       AND is_active = true
     LIMIT 1`,
    [medicationId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new MedicationServiceError(404, 'Medicamento no encontrado.');
  }

  const schedulesByMed = await fetchSchedules(pool, [row.id]);
  return mapMedication(row, schedulesByMed.get(row.id) ?? []);
}

export async function createMedication(
  userId: string,
  input: CreateMedicationInput
): Promise<MedicationResponse> {
  const schedules = input.schedules ?? [];
  const unitsPerIntake = input.unitsPerIntake ?? 1;
  assertDateRange(input.startDate, input.endDate);
  assertStockCoverage({
    amount: input.amount,
    startDate: input.startDate,
    endDate: input.endDate,
    scheduleTimes: schedules,
    unitsPerIntake,
  });

  const client = await pool.connect();
  const medicationId = uuidv4();

  try {
    await client.query('BEGIN');

    await assertNoDuplicateName(client, userId, input.name);

    const insertResult = await client.query<MedicationRow>(
      `INSERT INTO public.medications (
         id, user_id, name, dose, frequency, amount, units_per_intake,
         start_date, end_date, instructions,
         presentation, dose_amount, dose_unit, purpose, weekdays, meal_relation, reminder_enabled,
         is_active, archived_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8::date, $9::date, $10,
         $11, $12, $13, $14, $15::text[], $16, $17,
         true, NULL, NOW(), NOW()
       )
       RETURNING ${MEDICATION_SELECT}`,
      [
        medicationId,
        userId,
        input.name,
        input.dose,
        input.frequency ?? null,
        input.amount ?? null,
        unitsPerIntake,
        input.startDate ?? null,
        input.endDate ?? null,
        input.instructions ?? null,
        input.presentation ?? null,
        input.doseAmount ?? null,
        input.doseUnit ?? null,
        input.purpose ?? null,
        input.weekdays ?? null,
        input.mealRelation ?? null,
        input.reminderEnabled !== false,
      ]
    );

    const row = insertResult.rows[0];
    if (!row) {
      throw new MedicationServiceError(500, 'No se pudo crear el medicamento.');
    }

    await insertSchedules(client, medicationId, schedules);
    await client.query('COMMIT');

    const schedulesByMed = await fetchSchedules(pool, [medicationId]);
    return mapMedication(row, schedulesByMed.get(medicationId) ?? []);
  } catch (error) {
    await client.query('ROLLBACK');

    if (isUniqueViolation(error)) {
      throw new MedicationServiceError(409, 'Ya existe un horario duplicado para este medicamento.');
    }
    if (error instanceof MedicationServiceError) {
      throw error;
    }

    console.error('[medications:create]', error instanceof Error ? error.message : 'Error desconocido');
    throw new MedicationServiceError(500, 'Error interno al crear el medicamento.');
  } finally {
    client.release();
  }
}

export async function updateMedication(
  userId: string,
  medicationId: string,
  input: UpdateMedicationInput
): Promise<MedicationResponse> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<MedicationRow>(
      `SELECT ${MEDICATION_SELECT}
       FROM public.medications
       WHERE id = $1
         AND user_id = $2
         AND is_active = true
       FOR UPDATE`,
      [medicationId, userId]
    );

    const current = existing.rows[0];
    if (!current) {
      throw new MedicationServiceError(404, 'Medicamento no encontrado.');
    }

    const nextStart =
      input.startDate !== undefined ? input.startDate : current.start_date;
    const nextEnd = input.endDate !== undefined ? input.endDate : current.end_date;
    const nextAmount = input.amount !== undefined ? input.amount : current.amount;
    const nextUnits =
      input.unitsPerIntake !== undefined ? input.unitsPerIntake : current.units_per_intake ?? 1;
    assertDateRange(nextStart, nextEnd);

    if (input.name !== undefined) {
      await assertNoDuplicateName(client, userId, input.name, medicationId);
    }

    let nextScheduleTimes: string[];
    if (input.schedules !== undefined) {
      nextScheduleTimes = input.schedules;
    } else {
      const currentSchedules = await fetchSchedules(client, [medicationId]);
      nextScheduleTimes = (currentSchedules.get(medicationId) ?? []).map((s) => s.time);
    }

    assertStockCoverage({
      amount: nextAmount,
      startDate: nextStart,
      endDate: nextEnd,
      scheduleTimes: nextScheduleTimes,
      unitsPerIntake: nextUnits,
    });

    const updated = await client.query<MedicationRow>(
      `UPDATE public.medications
       SET
         name = COALESCE($3, name),
         dose = COALESCE($4, dose),
         frequency = CASE WHEN $5::boolean THEN $6 ELSE frequency END,
         amount = CASE WHEN $7::boolean THEN $8 ELSE amount END,
         units_per_intake = CASE WHEN $9::boolean THEN $10 ELSE units_per_intake END,
         start_date = CASE WHEN $11::boolean THEN $12::date ELSE start_date END,
         end_date = CASE WHEN $13::boolean THEN $14::date ELSE end_date END,
         instructions = CASE WHEN $15::boolean THEN $16 ELSE instructions END,
         presentation = CASE WHEN $17::boolean THEN $18 ELSE presentation END,
         dose_amount = CASE WHEN $19::boolean THEN $20 ELSE dose_amount END,
         dose_unit = CASE WHEN $21::boolean THEN $22 ELSE dose_unit END,
         purpose = CASE WHEN $23::boolean THEN $24 ELSE purpose END,
         weekdays = CASE WHEN $25::boolean THEN $26::text[] ELSE weekdays END,
         meal_relation = CASE WHEN $27::boolean THEN $28 ELSE meal_relation END,
         reminder_enabled = CASE WHEN $29::boolean THEN $30 ELSE reminder_enabled END,
         updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND is_active = true
       RETURNING ${MEDICATION_SELECT}`,
      [
        medicationId,
        userId,
        input.name ?? null,
        input.dose ?? null,
        input.frequency !== undefined,
        input.frequency ?? null,
        input.amount !== undefined,
        input.amount ?? null,
        input.unitsPerIntake !== undefined,
        input.unitsPerIntake ?? 1,
        input.startDate !== undefined,
        input.startDate ?? null,
        input.endDate !== undefined,
        input.endDate ?? null,
        input.instructions !== undefined,
        input.instructions ?? null,
        input.presentation !== undefined,
        input.presentation ?? null,
        input.doseAmount !== undefined,
        input.doseAmount ?? null,
        input.doseUnit !== undefined,
        input.doseUnit ?? null,
        input.purpose !== undefined,
        input.purpose ?? null,
        input.weekdays !== undefined,
        input.weekdays ?? null,
        input.mealRelation !== undefined,
        input.mealRelation ?? null,
        input.reminderEnabled !== undefined,
        input.reminderEnabled ?? true,
      ]
    );

    const row = updated.rows[0];
    if (!row) {
      throw new MedicationServiceError(404, 'Medicamento no encontrado.');
    }

    if (input.schedules !== undefined) {
      await client.query(
        'DELETE FROM public.medication_schedules WHERE medication_id = $1',
        [medicationId]
      );
      await insertSchedules(client, medicationId, input.schedules);
    }

    await client.query('COMMIT');

    const schedulesByMed = await fetchSchedules(pool, [medicationId]);
    return mapMedication(row, schedulesByMed.get(medicationId) ?? []);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof MedicationServiceError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new MedicationServiceError(409, 'Ya existe un horario duplicado para este medicamento.');
    }

    console.error('[medications:update]', error instanceof Error ? error.message : 'Error desconocido');
    throw new MedicationServiceError(500, 'Error interno al actualizar el medicamento.');
  } finally {
    client.release();
  }
}

/**
 * Soft delete / archivado.
 * Conserva la fila, schedules e intakes. El mensaje público sigue siendo “eliminado”.
 */
export async function deleteMedication(userId: string, medicationId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE public.medications
     SET
       is_active = false,
       archived_at = NOW(),
       updated_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND is_active = true`,
    [medicationId, userId]
  );

  if (result.rowCount === 0) {
    throw new MedicationServiceError(404, 'Medicamento no encontrado.');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
