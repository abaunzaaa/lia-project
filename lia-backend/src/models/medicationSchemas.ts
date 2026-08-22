import { z } from 'zod';

const timeHmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateYmdRegex = /^\d{4}-\d{2}-\d{2}$/;

const scheduleTimeSchema = z
  .string()
  .trim()
  .regex(timeHmRegex, 'Cada horario debe tener formato HH:mm (ejemplo: 08:00).');

const optionalDateSchema = z
  .string()
  .trim()
  .regex(dateYmdRegex, 'La fecha debe tener formato YYYY-MM-DD.')
  .nullable()
  .optional();

const unitsPerIntakeSchema = z
  .number({ error: 'Las unidades por toma deben ser un número.' })
  .int('Las unidades por toma deben ser un número entero.')
  .min(1, 'Las unidades por toma deben ser al menos 1.')
  .max(5, 'Las unidades por toma no pueden superar 5.');

function refineDateRange(
  data: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx
) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'La fecha final no puede ser anterior a la fecha inicial.',
    });
  }
}

function refineUniqueSchedules(schedules: string[] | undefined, ctx: z.RefinementCtx) {
  if (!schedules || schedules.length === 0) return;
  const unique = new Set(schedules);
  if (unique.size !== schedules.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['schedules'],
      message: 'No se permiten horarios duplicados.',
    });
  }
}

/** Días inclusivos entre dos fechas YYYY-MM-DD (UTC calendar). */
export function inclusiveDays(startYmd: string, endYmd: string): number {
  const start = Date.parse(`${startYmd}T00:00:00.000Z`);
  const end = Date.parse(`${endYmd}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function computeUnitsNeeded(params: {
  startDate: string;
  endDate: string;
  scheduleTimesLength: number;
  unitsPerIntake: number;
}): number {
  return (
    inclusiveDays(params.startDate, params.endDate) *
    params.scheduleTimesLength *
    params.unitsPerIntake
  );
}

/**
 * Valida que el stock alcance hasta endDate.
 * Retorna mensaje de error o null si es válido / no aplica.
 */
export function stockVsEndDateError(params: {
  amount: number | null | undefined;
  startDate?: string | null;
  endDate?: string | null;
  scheduleTimes: string[];
  unitsPerIntake: number;
}): string | null {
  const { amount, endDate, scheduleTimes, unitsPerIntake } = params;
  if (amount == null || !endDate) return null;

  const startDate = params.startDate || new Date().toISOString().slice(0, 10);
  if (endDate < startDate) return null;

  const needed = computeUnitsNeeded({
    startDate,
    endDate,
    scheduleTimesLength: scheduleTimes.length,
    unitsPerIntake,
  });

  if (amount < needed) {
    return `Con la cantidad disponible no alcanza hasta la fecha seleccionada. Necesitarías al menos ${needed} unidades.`;
  }
  return null;
}

export const createMedicationSchema = z
  .object({
    name: z
      .string({ error: 'El nombre es obligatorio.' })
      .trim()
      .min(1, 'El nombre es obligatorio.')
      .max(160, 'El nombre no puede superar 160 caracteres.'),
    dose: z
      .string({ error: 'La dosis es obligatoria.' })
      .trim()
      .min(1, 'La dosis es obligatoria.')
      .max(100, 'La dosis no puede superar 100 caracteres.'),
    frequency: z
      .string()
      .trim()
      .max(100, 'La frecuencia no puede superar 100 caracteres.')
      .nullable()
      .optional(),
    amount: z
      .number({ error: 'La cantidad debe ser un número.' })
      .int('La cantidad debe ser un número entero.')
      .min(0, 'La cantidad no puede ser negativa.')
      .nullable()
      .optional(),
    unitsPerIntake: unitsPerIntakeSchema.optional().default(1),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
    instructions: z
      .string()
      .trim()
      .max(2000, 'Las instrucciones no pueden superar 2000 caracteres.')
      .nullable()
      .optional(),
    schedules: z.array(scheduleTimeSchema).optional().default([]),
    userId: z.unknown().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.userId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['userId'],
        message: 'No se permite enviar userId. El usuario se obtiene del token.',
      });
    }
    refineDateRange(data, ctx);
    refineUniqueSchedules(data.schedules, ctx);

    const stockError = stockVsEndDateError({
      amount: data.amount,
      startDate: data.startDate,
      endDate: data.endDate,
      scheduleTimes: data.schedules ?? [],
      unitsPerIntake: data.unitsPerIntake ?? 1,
    });
    if (stockError) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: stockError,
      });
    }
  });

export const updateMedicationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre no puede estar vacío.')
      .max(160, 'El nombre no puede superar 160 caracteres.')
      .optional(),
    dose: z
      .string()
      .trim()
      .min(1, 'La dosis no puede estar vacía.')
      .max(100, 'La dosis no puede superar 100 caracteres.')
      .optional(),
    frequency: z
      .string()
      .trim()
      .max(100, 'La frecuencia no puede superar 100 caracteres.')
      .nullable()
      .optional(),
    amount: z
      .number({ error: 'La cantidad debe ser un número.' })
      .int('La cantidad debe ser un número entero.')
      .min(0, 'La cantidad no puede ser negativa.')
      .nullable()
      .optional(),
    unitsPerIntake: unitsPerIntakeSchema.optional(),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
    instructions: z
      .string()
      .trim()
      .max(2000, 'Las instrucciones no pueden superar 2000 caracteres.')
      .nullable()
      .optional(),
    schedules: z.array(scheduleTimeSchema).optional(),
    userId: z.unknown().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.userId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['userId'],
        message: 'No se permite enviar userId. El usuario se obtiene del token.',
      });
    }

    const hasAnyField =
      data.name !== undefined ||
      data.dose !== undefined ||
      data.frequency !== undefined ||
      data.amount !== undefined ||
      data.unitsPerIntake !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.instructions !== undefined ||
      data.schedules !== undefined;

    if (!hasAnyField) {
      ctx.addIssue({
        code: 'custom',
        message: 'Debes enviar al menos un campo para actualizar.',
      });
    }

    refineDateRange(data, ctx);
    refineUniqueSchedules(data.schedules, ctx);
  });

export type CreateMedicationSchema = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationSchema = z.infer<typeof updateMedicationSchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}
