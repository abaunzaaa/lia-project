/**
 * Cliente HTTP seguro para APIs farmacológicas oficiales.
 * Solo permite hosts en allowlist (anti-SSRF).
 */

const ALLOWED_HOSTS = new Set([
  'rxnav.nlm.nih.gov',
  'api.fda.gov',
  'dailymed.nlm.nih.gov',
]);

export class ExternalApiError extends Error {
  constructor(
    message: string,
    public kind: 'timeout' | 'http' | 'network' | 'invalid_url' | 'not_found'
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}

function assertAllowedUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ExternalApiError('URL externa inválida.', 'invalid_url');
  }

  if (url.protocol !== 'https:') {
    throw new ExternalApiError('Solo se permiten URLs HTTPS.', 'invalid_url');
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new ExternalApiError('Host externo no permitido.', 'invalid_url');
  }

  return url;
}

export async function fetchJson<T>(
  urlString: string,
  options?: {
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = assertAllowedUrl(urlString);
  const timeoutMs = options?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    if (response.status === 404) {
      throw new ExternalApiError('Recurso no encontrado.', 'not_found');
    }

    if (!response.ok) {
      throw new ExternalApiError(
        `Error HTTP ${response.status} al consultar servicio externo.`,
        'http'
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExternalApiError('La consulta externa tardó demasiado.', 'timeout');
    }

    throw new ExternalApiError('No se pudo contactar el servicio externo.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Quita acentos para mejorar coincidencia con vocabulario EN de RxNorm. */
export function foldAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function titleCaseName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Recorta textos largos de etiquetas sin inventar contenido. */
export function truncateText(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1).trimEnd()}…`;
}

export function cleanStringList(
  values: Array<string | null | undefined>,
  options?: { maxItems?: number; maxCharsPerItem?: number }
): string[] {
  const maxItems = options?.maxItems ?? 8;
  const maxChars = options?.maxCharsPerItem ?? 600;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    if (!raw) continue;
    const truncated = truncateText(raw, maxChars);
    if (!truncated) continue;
    const key = truncated.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(truncated);
    if (result.length >= maxItems) break;
  }

  return result;
}
