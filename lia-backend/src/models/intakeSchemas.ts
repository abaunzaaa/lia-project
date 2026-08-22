import { z } from 'zod';

const dateYmdRegex = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const dateStringSchema = z
  .string({ error: 'La fecha es obligatoria.' })
  .trim()
  .regex(dateYmdRegex, 'La fecha debe tener formato YYYY-MM-DD.');

export const timezoneSchema = z
  .string({ error: 'El timezone es obligatorio.' })
  .trim()
  .min(1, 'El timezone es obligatorio.')
  .refine(isValidIanaTimeZone, 'Timezone inválido. Usa un identificador IANA (ejemplo: America/Bogota).');

export const uuidSchema = z.string().uuid('El identificador no es un UUID válido.');

const MAX_RANGE_DAYS = 365;

function daysBetweenInclusive(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
}

function refineDateRange(
  data: { from: string; to: string },
  ctx: z.RefinementCtx,
  maxDays: number
) {
  if (data.to < data.from) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'La fecha final no puede ser anterior a la fecha inicial.',
    });
    return;
  }

  const days = daysBetweenInclusive(data.from, data.to);
  if (days > maxDays) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: `El rango no puede superar ${maxDays} días.`,
    });
  }
}

export const reminderQuerySchema = z.object({
  date: dateStringSchema,
  timezone: timezoneSchema,
});

export const createIntakeSchema = z
  .object({
    medicationId: uuidSchema,
    scheduleId: uuidSchema,
    date: dateStringSchema,
    timezone: timezoneSchema,
    status: z.enum(['taken', 'skipped'], {
      error: 'El estado debe ser taken o skipped.',
    }),
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
  });

export const historyQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    timezone: timezoneSchema,
  })
  .superRefine((data, ctx) => refineDateRange(data, ctx, MAX_RANGE_DAYS));

export const adherenceQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    timezone: timezoneSchema,
  })
  .superRefine((data, ctx) => refineDateRange(data, ctx, MAX_RANGE_DAYS));

/** Insights de historial: máximo 90 días. */
export const MAX_INSIGHTS_RANGE_DAYS = 90;

export const historyInsightsQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    timezone: timezoneSchema,
  })
  .superRefine((data, ctx) => refineDateRange(data, ctx, MAX_INSIGHTS_RANGE_DAYS));

export type ReminderQuery = z.infer<typeof reminderQuerySchema>;
export type CreateIntakeInput = z.infer<typeof createIntakeSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type AdherenceQuery = z.infer<typeof adherenceQuerySchema>;
export type HistoryInsightsQuery = z.infer<typeof historyInsightsQuerySchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}

export { MAX_RANGE_DAYS };
