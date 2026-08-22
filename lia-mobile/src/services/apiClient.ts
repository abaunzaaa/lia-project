import { API_BASE_URL } from '../config/api';
import { getAuthToken, clearAuthToken } from './authApi';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function looksTechnical(message: string): boolean {
  return /zod|postgres|sql|stack|ECONNREFUSED|fetch failed|Network request failed/i.test(message);
}

export function friendlyApiMessage(
  status: number | undefined,
  raw: string | undefined,
  network: boolean,
  options?: { notFoundMessage?: string }
): string {
  if (network) {
    return 'No pudimos conectarnos con LIA. Revisa tu conexión e inténtalo nuevamente.';
  }
  if (status === 401) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (status === 404) {
    return options?.notFoundMessage || 'Este recurso ya no está disponible.';
  }
  if (status === 400) {
    if (raw && !looksTechnical(raw)) return raw;
    return 'Revisa los datos e inténtalo nuevamente.';
  }
  if (status === 500 || status === undefined) {
    return 'No pudimos completar la acción. Inténtalo nuevamente.';
  }
  if (raw && !looksTechnical(raw)) return raw;
  return 'No pudimos completar la acción. Inténtalo nuevamente.';
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { message?: string };
    return body?.message;
  } catch {
    return undefined;
  }
}

export async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  if (!token) {
    throw new ApiClientError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  }
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function apiRequest(
  path: string,
  init?: RequestInit,
  options?: { notFoundMessage?: string }
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiClientError(friendlyApiMessage(undefined, undefined, true), undefined);
  }

  if (!response.ok) {
    const raw = await readErrorMessage(response);
    if (response.status === 401) {
      await clearAuthToken();
    }
    throw new ApiClientError(
      friendlyApiMessage(response.status, raw, false, options),
      response.status
    );
  }

  return response;
}
