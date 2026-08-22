import { z } from 'zod';

function toStringArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (value === '' || value == null) return [];
  if (typeof value === 'string') return [value];
  return value;
}

function toNullableString(value: unknown): unknown {
  if (value === '' || value == null) return null;
  return value;
}

/** Respuesta estructurada esperada de la IA (solo campos simplificados). */
export const aiSimplifiedContentSchema = z.object({
  purpose: z.preprocess(toNullableString, z.string().trim().max(320).nullable()),
  importantInformation: z.preprocess(
    toStringArray,
    z.array(z.string().trim().min(1).max(220)).max(5)
  ),
  precautions: z.preprocess(
    toStringArray,
    z.array(z.string().trim().min(1).max(220)).max(5)
  ),
});

export type AiSimplifiedContent = z.infer<typeof aiSimplifiedContentSchema>;
