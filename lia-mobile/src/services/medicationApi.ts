import { API_BASE_URL } from '../config/api';
import { getAuthToken, clearAuthToken } from './authApi';
import { Medication, MedicationSchedule } from '../types';

/** Respuesta de medicamento del backend (camelCase). */
export type ApiMedication = {
  id: string;
  name: string;
  dose: string;
  frequency: string | null;
  amount: number | null;
  /** Unidades por toma (si el backend lo envía). */
  unitsPerIntake?: number | null;
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
  imageUrl?: string | null;
  schedules: MedicationSchedule[];
  createdAt: string;
  updatedAt: string | null;
};

export type CreateMedicationPayload = {
  name: string;
  dose: string;
  frequency?: string | null;
  amount?: number | null;
  unitsPerIntake?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
  schedules?: string[];
};

export type UpdateMedicationPayload = {
  name?: string;
  dose?: string;
  frequency?: string | null;
  amount?: number | null;
  unitsPerIntake?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
  schedules?: string[];
};

type ListBody = {
  success: boolean;
  data?: ApiMedication[];
  message?: string;
};

type OneBody = {
  success: boolean;
  message?: string;
  data?: { medication: ApiMedication };
};

type DeleteBody = {
  success: boolean;
  message?: string;
};

export class MedicationApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'MedicationApiError';
  }
}

function looksTechnical(message: string): boolean {
  return /zod|postgres|sql|stack|ECONNREFUSED|fetch failed|Network request failed/i.test(message);
}

function friendlyMessage(status: number | undefined, raw: string | undefined, network: boolean): string {
  if (network) {
    return 'No pudimos conectarnos con LIA. Revisa tu conexión e inténtalo nuevamente.';
  }
  if (status === 401) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (status === 404) {
    return 'Este medicamento ya no está disponible.';
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

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  if (!token) {
    throw new MedicationApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  }
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new MedicationApiError(
      friendlyMessage(undefined, undefined, true),
      undefined
    );
  }
}

async function handleHttpError(response: Response): Promise<never> {
  const raw = await readErrorMessage(response);
  if (response.status === 401) {
    await clearAuthToken();
  }
  throw new MedicationApiError(friendlyMessage(response.status, raw, false), response.status);
}

/** Extrae unidades por toma desde dose ("2 tabletas") cuando el API no las envía. */
function unitsFromDose(dose: string): number | undefined {
  const match = dose.trim().match(/^(\d+(?:[.,]\d+)?)\s+/);
  if (!match) return undefined;
  const n = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.max(1, Math.round(n));
}

/** Mapea respuesta API → modelo UI (quantity/description/time compatibles). */
export function mapApiMedicationToLocal(api: ApiMedication, userId = ''): Medication {
  const schedules = Array.isArray(api.schedules) ? api.schedules : [];
  const times = schedules.map((s) => s.time).filter(Boolean);
  const unitsPerIntake =
    api.unitsPerIntake != null && api.unitsPerIntake > 0
      ? Math.floor(api.unitsPerIntake)
      : unitsFromDose(api.dose);
  return {
    id: api.id,
    userId,
    name: api.name,
    dose: api.dose,
    quantity: api.amount ?? 0,
    unitsPerIntake,
    frequency: api.frequency ?? '',
    time: times[0] || '08:00',
    schedules,
    startDate: api.startDate || '',
    endDate: api.endDate || undefined,
    description: api.instructions || undefined,
    imageUrl: api.imageUrl || undefined,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt || undefined,
  };
}

/**
 * GET /medications → { success, data: ApiMedication[] }
 */
export async function getMedications(): Promise<Medication[]> {
  const headers = await authHeaders();
  const response = await request('/medications', { method: 'GET', headers });

  if (!response.ok) {
    await handleHttpError(response);
  }

  const body = (await response.json()) as ListBody;
  const list = Array.isArray(body.data) ? body.data : [];
  return list.map((item) => mapApiMedicationToLocal(item));
}

/**
 * GET /medications/:id → { success, data: { medication } }
 */
export async function getMedication(id: string): Promise<Medication> {
  const headers = await authHeaders();
  const response = await request(`/medications/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    await handleHttpError(response);
  }

  const body = (await response.json()) as OneBody;
  if (!body.data?.medication) {
    throw new MedicationApiError('Este medicamento ya no está disponible.', 404);
  }
  return mapApiMedicationToLocal(body.data.medication);
}

/**
 * POST /medications → { success, data: { medication } }
 */
export async function createMedication(input: CreateMedicationPayload): Promise<Medication> {
  const headers = await authHeaders();
  const response = await request('/medications', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    await handleHttpError(response);
  }

  const body = (await response.json()) as OneBody;
  if (!body.data?.medication) {
    throw new MedicationApiError('No pudimos completar la acción. Inténtalo nuevamente.');
  }
  return mapApiMedicationToLocal(body.data.medication);
}

/**
 * PUT /medications/:id → { success, data: { medication } }
 */
export async function updateMedication(
  id: string,
  input: UpdateMedicationPayload
): Promise<Medication> {
  const headers = await authHeaders();
  const response = await request(`/medications/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    await handleHttpError(response);
  }

  const body = (await response.json()) as OneBody;
  if (!body.data?.medication) {
    throw new MedicationApiError('No pudimos completar la acción. Inténtalo nuevamente.');
  }
  return mapApiMedicationToLocal(body.data.medication);
}

/**
 * DELETE /medications/:id → { success, message }
 */
export async function deleteMedication(id: string): Promise<void> {
  const headers = await authHeaders();
  const response = await request(`/medications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    await handleHttpError(response);
  }

  // body opcional; 200 con success es suficiente
  void ((await response.json()) as DeleteBody);
}
