import { z } from 'zod';

const MAX_HISTORY = 10;
const MAX_HISTORY_CONTENT = 800;

export const drugChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    error: 'Cada mensaje del historial debe ser user o assistant.',
  }),
  content: z
    .string({ error: 'El contenido del historial es obligatorio.' })
    .trim()
    .min(1, 'El contenido del historial no puede estar vacío.')
    .max(MAX_HISTORY_CONTENT, `Cada mensaje del historial admite máximo ${MAX_HISTORY_CONTENT} caracteres.`),
});

export const drugChatRequestSchema = z
  .object({
    medication: z
      .object({
        rxcui: z
          .string()
          .trim()
          .regex(/^\d+$/, 'El rxcui debe ser numérico.')
          .optional(),
        name: z.string().trim().min(2).max(160).optional(),
      })
      .strict()
      .superRefine((med, ctx) => {
        if (!med.rxcui && !med.name) {
          ctx.addIssue({
            code: 'custom',
            message: 'Debes indicar medication.rxcui o medication.name.',
          });
        }
      }),
    message: z
      .string({ error: 'El mensaje es obligatorio.' })
      .trim()
      .min(1, 'Escribe una pregunta.')
      .max(1000, 'El mensaje es demasiado largo (máximo 1000 caracteres).'),
    history: z.array(drugChatHistoryItemSchema).max(MAX_HISTORY).optional().default([]),
    /** Solo contexto de UI; no se usa como evidencia clínica. */
    registeredDose: z.string().trim().max(100).optional(),
  })
  .strict();

export type DrugChatRequest = z.infer<typeof drugChatRequestSchema>;
export type DrugChatHistoryItem = z.infer<typeof drugChatHistoryItemSchema>;

export { MAX_HISTORY };

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}
