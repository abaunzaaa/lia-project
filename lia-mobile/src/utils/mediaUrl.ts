import { API_BASE_URL } from '../config/api';

/** Convierte /uploads/... en URL absoluta para <Image>. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|file:|data:|content:|asset:)/i.test(trimmed)) return trimmed;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export function isCapturedMedicationPhoto(url?: string | null): boolean {
  if (!url) return false;
  return /\/uploads\/camera\//i.test(url);
}
