import { z } from 'zod';
import { drugChatHistoryItemSchema, MAX_HISTORY } from './drugChatSchemas';

export const accountChatRequestSchema = z
  .object({
    message: z
      .string({ error: 'El mensaje es obligatorio.' })
      .trim()
      .min(1, 'Escribe una pregunta.')
      .max(1000, 'El mensaje es demasiado largo (máximo 1000 caracteres).'),
    history: z.array(drugChatHistoryItemSchema).max(MAX_HISTORY).optional().default([]),
  })
  .strict();

export type AccountChatRequest = z.infer<typeof accountChatRequestSchema>;

export function formatAccountChatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}
