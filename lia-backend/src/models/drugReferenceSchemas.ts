import { z } from 'zod';

export const drugSearchQuerySchema = z.object({
  q: z
    .string({ error: 'El texto de búsqueda es obligatorio.' })
    .trim()
    .min(2, 'Escribe al menos 2 caracteres para buscar.')
    .max(120, 'La búsqueda es demasiado larga.'),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const drugInfoQuerySchema = z
  .object({
    rxcui: z
      .string()
      .trim()
      .regex(/^\d+$/, 'El identificador rxcui debe ser numérico.')
      .optional(),
    name: z.string().trim().min(2).max(160).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.rxcui && !data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'Debes indicar rxcui o name.',
      });
    }
  });

export type DrugSearchQuery = z.infer<typeof drugSearchQuerySchema>;
export type DrugInfoQuery = z.infer<typeof drugInfoQuerySchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}
