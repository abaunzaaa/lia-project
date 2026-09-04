import { z } from 'zod';

const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;
const PASSWORD_UPPER = /[A-Z]/

const PASSWORD_RULES_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial.';

/**
 * Normaliza y valida teléfono colombiano móvil.
 * Acepta: 3001234567 | +573001234567 | 573001234567
 */
export function normalizeColombianPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-().]/g, '');
  if (!stripped) return null;

  let digits = stripped;
  if (digits.startsWith('+57')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('57') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (!/^\d+$/.test(digits)) return null;
  if (digits.length !== 10) return null;
  if (!digits.startsWith('3')) return null;

  return digits;
}

const emergencyContactSchema = z
  .string({ error: 'Ingresa un número de teléfono completo.' })
  .trim()
  .min(1, 'Ingresa un número de teléfono completo.')
  .transform((value, ctx) => {
    const normalized = normalizeColombianPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ingresa un número de teléfono completo.',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const registerSchema = z.object({
  fullName: z
    .string({ error: 'El nombre completo es obligatorio.' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar 120 caracteres.'),
  /** Acepta number o string numérico desde clientes que mandan edad como texto. */
  age: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
      }
      return value;
    },
    z
      .number({ error: 'La edad es obligatoria.' })
      .int('La edad debe ser un número entero.')
      .min(18, 'La edad mínima es 18 años.')
      .max(120, 'La edad máxima es 120 años.')
  ),
  email: z
    .string({ error: 'El correo es obligatorio.' })
    .trim()
    .toLowerCase()
    .email('El correo no es válido.'),
  password: z
    .string({ error: 'La contraseña es obligatoria.' })
    .min(8, PASSWORD_RULES_MESSAGE)
    .refine((value) => PASSWORD_UPPER.test(value), {
      message: PASSWORD_RULES_MESSAGE,
    })
    .refine((value) => PASSWORD_SPECIAL.test(value), {
      message: PASSWORD_RULES_MESSAGE,
    }),
  emergencyContact: emergencyContactSchema,
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'El correo es obligatorio.' })
    .trim()
    .toLowerCase()
    .email('El correo no es válido.'),
  password: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

function normalizeStoredEmergencyPhone(raw: string): string | null {
  const colombian = normalizeColombianPhone(raw);
  if (colombian) return colombian;
  const stripped = raw.replace(/[\s\-().]/g, '');
  if (!stripped) return null;
  const plus = stripped.startsWith('+');
  const digits = plus ? stripped.slice(1) : stripped;
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return plus ? `+${digits}` : digits;
}

export const updateEmergencyContactSchema = z.object({
  emergencyContact: z
    .string({ error: 'Ingresa un número de teléfono válido.' })
    .trim()
    .min(1, 'Ingresa un número de contacto.')
    .transform((value, ctx) => {
      const normalized = normalizeStoredEmergencyPhone(value);
      if (!normalized) {
        ctx.addIssue({
          code: 'custom',
          message: 'Ingresa un número de teléfono válido.',
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

export type UpdateEmergencyContactInput = z.infer<typeof updateEmergencyContactSchema>;

export function formatZodError(error: z.ZodError): string {
  const unique = [...new Set(error.issues.map((issue) => issue.message))];
  return unique.join(' ');
}

/** Código estable para clientes (sin detalles técnicos). */
export function registerZodErrorCode(error: z.ZodError): string {
  const paths = error.issues.map((issue) => issue.path.join('.'));
  if (paths.some((p) => p.includes('emergencyContact'))) return 'invalid_phone';
  if (paths.some((p) => p.includes('password'))) return 'invalid_password';
  if (paths.some((p) => p.includes('email'))) return 'invalid_email';
  if (paths.some((p) => p.includes('age'))) return 'invalid_age';
  return 'validation';
}
