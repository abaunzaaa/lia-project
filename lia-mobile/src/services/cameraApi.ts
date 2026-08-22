import { API_BASE_URL } from '../config/api';
import { getAuthToken, clearAuthToken } from './authApi';
import { PatientDrugInfo } from '../types';

/** Debe coincidir con DEVICE_ID de la ESP32 (secrets.h). */
export const LIA_CAMERA_DEVICE_ID = 'lia-camera-01';

export type CameraSessionStatus = 'waiting' | 'recognized' | 'expired' | 'failed' | 'processing';

export type CameraSessionCreated = {
  id: string;
  status: CameraSessionStatus;
  expiresAt?: string;
  deviceId: string;
};

export type CameraPollWaiting = { status: 'waiting' };
export type CameraPollExpired = { status: 'expired'; message?: string };
export type CameraPollFailed = { status: 'failed'; message?: string };
export type CameraPollRecognized = {
  status: 'recognized';
  result: {
    name: string;
    rxcui?: string | null;
    patientInfo?: PatientDrugInfo | null;
    voiceText?: string | null;
  };
};

export type CameraSessionPoll =
  | CameraPollWaiting
  | CameraPollExpired
  | CameraPollFailed
  | CameraPollRecognized
  | CameraSessionCreated;

export class CameraApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'CameraApiError';
  }
}

function looksTechnical(message: string): boolean {
  return /zod|postgres|sql|stack|ECONNREFUSED|fetch failed|Network request failed/i.test(
    message
  );
}

function friendlyMessage(
  status: number | undefined,
  raw: string | undefined,
  network: boolean
): string {
  if (network) {
    return 'No pudimos conectarnos con LIA. Revisa tu conexión e inténtalo nuevamente.';
  }
  if (status === 401) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (status === 404) {
    return 'La sesión de cámara ya no está disponible.';
  }
  if (status === 400) {
    if (raw && !looksTechnical(raw)) return raw;
    return 'No pudimos iniciar la sesión de cámara. Inténtalo nuevamente.';
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
    throw new CameraApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
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
    throw new CameraApiError(friendlyMessage(undefined, undefined, true), undefined);
  }
}

async function handleHttpError(response: Response): Promise<never> {
  const raw = await readErrorMessage(response);
  if (response.status === 401) {
    await clearAuthToken();
  }
  throw new CameraApiError(friendlyMessage(response.status, raw, false), response.status);
}

/**
 * Normaliza resultado de poll recognized → campos de UI.
 */
export function normalizeCameraResult(
  poll: CameraPollRecognized
): {
  name: string;
  activeIngredient: string | null;
  purpose: string | null;
  importantPoints: string[];
  source: string | null;
} | null {
  const info = poll.result?.patientInfo;
  const voiceFallback =
    typeof poll.result?.voiceText === 'string' ? poll.result.voiceText.trim() : '';
  const name = (info?.name || poll.result?.name || '').trim();
  if (!name && !voiceFallback) return null;

  const source =
    typeof info?.source === 'object' && info?.source?.name
      ? info.source.name
      : null;

  return {
    name: name || 'Medicamento identificado',
    activeIngredient: info?.genericName?.trim() || null,
    purpose: info?.purpose?.trim() || voiceFallback || null,
    importantPoints: Array.isArray(info?.importantInformation)
      ? info.importantInformation.filter((p) => typeof p === 'string' && p.trim())
      : [],
    source,
  };
}

/**
 * POST /camera/sessions — { deviceId }
 * Respuesta plana: { id, status, expiresAt, deviceId }
 */
export async function createCameraSession(
  deviceId = LIA_CAMERA_DEVICE_ID
): Promise<CameraSessionCreated> {
  const headers = await authHeaders();
  const response = await request('/camera/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ deviceId }),
  });

  if (!response.ok) {
    await handleHttpError(response);
  }

  const body = (await response.json()) as CameraSessionCreated & {
    success?: boolean;
    data?: CameraSessionCreated;
    message?: string;
  };

  if (body.data?.id) return body.data;
  if (body.id) {
    return {
      id: body.id,
      status: body.status || 'waiting',
      expiresAt: body.expiresAt,
      deviceId: body.deviceId || deviceId,
    };
  }

  throw new CameraApiError('No pudimos completar la acción. Inténtalo nuevamente.');
}

/**
 * GET /camera/sessions/:id
 * Respuesta: { status: 'waiting' } | { status: 'recognized', result } | { status: 'expired' }
 */
export async function getCameraSession(sessionId: string): Promise<CameraSessionPoll> {
  const headers = await authHeaders();
  const response = await request(`/camera/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    await handleHttpError(response);
  }

  const body = (await response.json()) as CameraSessionPoll & {
    data?: CameraSessionPoll;
  };

  if (body.data && typeof body.data === 'object' && 'status' in body.data) {
    return body.data;
  }
  return body as CameraSessionPoll;
}
