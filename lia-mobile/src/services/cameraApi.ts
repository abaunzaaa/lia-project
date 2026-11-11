import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { API_BASE_URL } from '../config/api';
import { getAuthToken, clearAuthToken } from './authApi';
import { PatientDrugInfo } from '../types';
import { catalogAgreesWithReadName, isGenericMedicationReading } from '../utils/recognizedMedication';

/** Debe coincidir con DEVICE_ID de la ESP32 (secrets.h). */
export const LIA_CAMERA_DEVICE_ID = 'lia-camera-01';

export type CameraSessionStatus = 'waiting' | 'recognized' | 'expired' | 'failed' | 'processing';

export type CameraSessionCreated = {
  id: string;
  status: CameraSessionStatus;
  expiresAt?: string;
  deviceId: string;
};

export type CameraPollWaiting = { status: 'waiting'; imageUrl?: string | null };
export type CameraPollExpired = { status: 'expired'; message?: string };
export type CameraPollFailed = { status: 'failed'; message?: string };
export type CameraPollProcessing = { status: 'processing'; imageUrl?: string | null };
export type CameraPollRecognized = {
  status: 'recognized';
  result: {
    name: string;
    rxcui?: string | null;
    patientInfo?: PatientDrugInfo | null;
    voiceText?: string | null;
    imageUrl?: string | null;
  };
};

export type CameraSessionPoll =
  | CameraPollWaiting
  | CameraPollExpired
  | CameraPollFailed
  | CameraPollProcessing
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
  if (status === 502 || status === 503 || status === 504) {
    if (raw && !looksTechnical(raw)) return raw;
    return 'LÍA no respondió. Revisa que el servidor esté encendido e inténtalo de nuevo.';
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

function stripSimpleMarkdown(value: string): string {
  return value.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

function isUsableProductName(value: string): boolean {
  const name = stripSimpleMarkdown(value);
  if (!name) return false;
  if (/^medicamento identificado$/i.test(name)) return false;
  if (/^NO_IDENTIFICADO$/i.test(name)) return false;
  if (name.length < 2 || name.length > 80) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  if (/https?:\/\//i.test(name)) return false;
  if (/[{}\[\]<>]/.test(name)) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}\s.'’\-\/()+,]*$/u.test(name);
}

function usableNameOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = stripSimpleMarkdown(value);
  return isUsableProductName(cleaned) ? cleaned : null;
}

/** Extrae un nombre corto del texto ya reconocido. No llama a IA. */
function extractNameFromRecognizedText(raw: string): string | null {
  const text = stripSimpleMarkdown(raw);
  if (!text) return null;

  const intro = text.match(
    /(?:el\s+)?(?:producto|medicamento|fármaco|farmaco)\s+es\s+([^,.]+)/i
  );
  const fromIntro = usableNameOrNull(intro?.[1]);
  if (fromIntro) return fromIntro;

  const bold = raw.match(/\*\*([^*]{2,80})\*\*/);
  const fromBold = usableNameOrNull(bold?.[1]);
  if (fromBold) return fromBold;

  const firstSentence = text.split(/[.!?]/)[0]?.trim() || '';
  return usableNameOrNull(firstSentence);
}

/**
 * Normaliza resultado de poll recognized → campos de UI.
 * "Medicamento identificado" es solo label visual; nunca se usa como nombre.
 */
export function normalizeCameraResult(
  poll: CameraPollRecognized
): {
  name: string;
  activeIngredient: string | null;
  purpose: string | null;
  observedReading: string | null;
  importantPoints: string[];
  source: string | null;
  imageUrl: string | null;
} | null {
  const info = poll.result?.patientInfo;
  const voiceFallback =
    typeof poll.result?.voiceText === 'string' ? poll.result.voiceText.trim() : '';
  const structuredName = usableNameOrNull(info?.name) || usableNameOrNull(poll.result?.name);
  const name = structuredName || extractNameFromRecognizedText(voiceFallback) || '';
  if (!name && !voiceFallback) return null;

  const agrees = catalogAgreesWithReadName(name, info);
  const rawSource =
    agrees && typeof info?.source === 'object' && info?.source?.name ? info.source.name : null;
  const source = rawSource && rawSource !== 'Public' ? rawSource : null;
  return {
    name,
    activeIngredient: agrees ? info?.genericName?.trim() || null : null,
    purpose: agrees ? info?.purpose?.trim() || null : null,
    observedReading:
      !agrees && voiceFallback && !isGenericMedicationReading(voiceFallback) ? voiceFallback : null,
    importantPoints:
      agrees && Array.isArray(info?.importantInformation)
        ? info.importantInformation.filter((p) => typeof p === 'string' && p.trim())
        : [],
    source,
    imageUrl: poll.result?.imageUrl?.trim() || null,
  };
}

export type ObservedPackagePayload = {
  ingredients?: Array<{ name?: string; strength?: string | null }>;
  presentation?: string | null;
  route?: string | null;
  manufacturer?: string | null;
  sanitaryRegistry?: string | null;
};

export type DirectRecognitionPayload = {
  name?: string;
  description?: string;
  dose?: string;
  confidence?: number;
  rxcui?: string | null;
  patientInfo?: PatientDrugInfo | null;
  voiceText?: string | null;
  identified?: boolean;
  imageUrl?: string | null;
  observedPackage?: ObservedPackagePayload | null;
  compositionVerified?: boolean;
  message?: string;
  error?: string;
};

export type PhoneRecognitionView = {
  name: string;
  activeIngredient: string | null;
  purpose: string | null;
  observedReading: string | null;
  importantPoints: string[];
  presentation: string | null;
  source: string | null;
  imageUrl: string | null;
};

function packageReading(pkg: ObservedPackagePayload): string | null {
  const parts = (pkg.ingredients || [])
    .map((item) => [item.name?.trim(), item.strength?.trim()].filter(Boolean).join(' '))
    .filter(Boolean);
  if (parts.length === 0) return null;
  const ingredients =
    parts.length === 1
      ? parts[0]
      : parts.length === 2
        ? `${parts[0]} y ${parts[1]}`
        : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  const where = [pkg.presentation?.trim(), pkg.route?.trim() ? `vía ${pkg.route.trim()}` : '']
    .filter(Boolean)
    .join(', ');
  const detail = where ? `${ingredients}, en ${where}` : ingredients;
  return `En la foto se lee ${detail}.`;
}

/**
 * Adapta la respuesta directa de reconocimiento al mismo modelo de la cámara física.
 * Si la IA no confirmó el medicamento, no inventa un nombre.
 */
export function normalizeDirectRecognition(
  payload: DirectRecognitionPayload
): PhoneRecognitionView | null {
  if (payload.identified !== true) return null;

  const readName = usableNameOrNull(payload.name);
  if (!readName) return null;

  const imageUrl = payload.imageUrl?.trim() || null;
  const unverified =
    payload.compositionVerified !== true &&
    (payload.observedPackage?.ingredients?.length || 0) > 0
      ? packageReading(payload.observedPackage || {})
      : null;
  if (unverified) {
    const info = payload.patientInfo;
    const backedPurpose =
      info && !info.genericName?.trim() && info.importantInformation.length === 0
        ? info.purpose?.trim() || null
        : null;
    return {
      name: readName,
      activeIngredient: null,
      purpose: backedPurpose,
      observedReading: unverified,
      importantPoints: [],
      presentation: backedPurpose ? info?.dosageForms?.[0]?.trim() || null : null,
      source: backedPurpose ? info?.source?.reference?.trim() || null : null,
      imageUrl,
    };
  }

  const view = normalizeCameraResult({
    status: 'recognized',
    result: {
      name: readName,
      rxcui: payload.rxcui,
      patientInfo: payload.patientInfo,
      voiceText: payload.voiceText,
      imageUrl,
    },
  });

  const described = payload.description?.trim() || '';
  const usefulDescription =
    described &&
    described !== 'No se pudo obtener información adicional del medicamento.' &&
    !isGenericMedicationReading(described)
      ? described
      : null;
  const reference = payload.patientInfo?.source?.reference?.trim() || '';
  const presentation = payload.patientInfo?.dosageForms?.[0]?.trim() || payload.dose?.trim() || null;
  return {
    name: readName,
    activeIngredient: view?.activeIngredient || null,
    purpose: view?.purpose || usefulDescription,
    observedReading: view?.observedReading || null,
    importantPoints: view?.importantPoints || [],
    presentation,
    source: reference || view?.source || null,
    imageUrl: view?.imageUrl || imageUrl,
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

const MOBILE_RECOGNITION_TIMEOUT_MS = 120_000;

export class CameraRequestCancelled extends CameraApiError {
  constructor() {
    super('cancelled');
    this.name = 'CameraRequestCancelled';
  }
}

function previewableImageUri(uri: string): string {
  const trimmed = uri.trim();
  if (/^(file:|content:|blob:|data:|https?:|ph:|assets-library:|asset:)/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  if (trimmed.length > 80 && /^[a-z0-9+/=\s]+$/i.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed.replace(/\s+/g, '')}`;
  }
  return trimmed;
}

const MOBILE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

function diagnosticLabel(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const message = error.message
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .slice(0, 160);
  return `${error.name}: ${message}`;
}

/**
 * Expo SDK 58 usa expo/fetch como fetch global. Ese fetch solo admite
 * string, Blob o un objeto con bytes(). El descriptor { uri, name, type }
 * de React Native lanza antes de salir del dispositivo y se veía como
 * un fallo de conexión.
 */
function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isEmptyProxyResponse(status: number, body: DirectRecognitionPayload): boolean {
  return (status === 502 || status === 503 || status === 504) && !body.message && !body.error;
}

async function readPreparedPhoto(uri: string): Promise<Uint8Array> {
  const source = new File(uri);
  const size = source.exists ? source.size : 0;
  if (size < 1) {
    throw new CameraApiError('La fotografía no es válida. Vuelve a tomarla.');
  }
  if (size > MOBILE_PHOTO_MAX_BYTES) {
    throw new CameraApiError(
      'La foto es demasiado grande. Acerca menos el medicamento e inténtalo otra vez.',
      400
    );
  }

  let data = await source.bytes();
  if (data.byteLength < size) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    data = await source.bytes();
  }
  if (data.byteLength < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data.byteLength < size) {
    throw new CameraApiError('La fotografía no es válida. Vuelve a tomarla.');
  }
  return data;
}

function appendPreparedPhoto(form: FormData, data: Uint8Array): void {
  const photo = {
    name: 'medication.jpg',
    type: 'image/jpeg',
    bytes: () => data,
  };
  form.append('image', photo as unknown as Blob);
}

async function appendMedicationPhoto(form: FormData, uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    const response = await fetch(previewableImageUri(uri));
    const blob = await response.blob();
    if (blob.size > MOBILE_PHOTO_MAX_BYTES) {
      throw new CameraApiError(
        'La foto es demasiado grande. Acerca menos el medicamento e inténtalo otra vez.',
        400
      );
    }
    form.append('image', blob, 'medication.jpg');
    return blob.size;
  }

  const source = new File(uri);
  const bytes = source.exists ? source.size : 0;
  if (bytes < 1) {
    throw new CameraApiError('La fotografía no es válida. Vuelve a tomarla.');
  }
  if (bytes > MOBILE_PHOTO_MAX_BYTES) {
    throw new CameraApiError(
      'La foto es demasiado grande. Acerca menos el medicamento e inténtalo otra vez.',
      400
    );
  }

  const photo = {
    name: 'medication.jpg',
    type: 'image/jpeg',
    bytes: () => source.bytes(),
  };
  form.append('image', photo as unknown as Blob);
  return bytes;
}

/**
 * POST /camera/mobile-photo
 * Envía la foto del celular al reconocimiento que ya usa LÍA.
 * No crea una sesión de la cámara física.
 */
export async function recognizeMedicationPhoto(
  uri: string,
  signal?: AbortSignal
): Promise<DirectRecognitionPayload> {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new CameraApiError('La fotografía no es válida. Vuelve a tomarla.');
  }

  const token = await getAuthToken();
  if (!token) {
    throw new CameraApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  }

  const prepared =
    Platform.OS === 'web' ? null : await readPreparedPhoto(trimmed);
  const requestId = newRequestId();
  if (__DEV__) {
    console.log(
      `[camera-mobile-photo] id=${requestId} prepared bytes=${prepared?.byteLength ?? 0}`
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MOBILE_RECOGNITION_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  const postPhoto = async (attempt: number): Promise<Response> => {
    const form = new FormData();
    if (prepared) {
      appendPreparedPhoto(form, prepared);
    } else {
      await appendMedicationPhoto(form, trimmed);
    }
    const started = Date.now();
    const response = await fetch(`${API_BASE_URL}/camera/mobile-photo`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Request-Id': `${requestId}-${attempt}`,
      },
      body: form,
      signal: controller.signal,
    });
    if (__DEV__) {
      console.log(
        `[camera-mobile-photo] id=${requestId} attempt=${attempt} status=${response.status} ms=${Date.now() - started}`
      );
    }
    return response;
  };

  const readBody = async (response: Response): Promise<DirectRecognitionPayload> => {
    try {
      return (await response.json()) as DirectRecognitionPayload;
    } catch {
      return {};
    }
  };

  try {
    let response: Response;
    let body: DirectRecognitionPayload;
    let sent = 1;
    try {
      response = await postPhoto(1);
      body = await readBody(response);
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw error;
      }
      sent = 2;
      response = await postPhoto(2);
      body = await readBody(response);
    }
    if (sent === 1 && isEmptyProxyResponse(response.status, body) && !signal?.aborted) {
      response = await postPhoto(2);
      body = await readBody(response);
    }

    if (response.status === 401) {
      await clearAuthToken();
    }

    if (!response.ok) {
      const raw = body.message || body.error;
      throw new CameraApiError(friendlyMessage(response.status, raw, false), response.status);
    }

    return body;
  } catch (error) {
    if (signal?.aborted) {
      throw new CameraRequestCancelled();
    }
    if (error instanceof CameraApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CameraApiError(
        'El reconocimiento tardó demasiado. Inténtalo de nuevo.',
        504
      );
    }
    if (__DEV__) {
      console.warn(`[camera-mobile-photo] ${diagnosticLabel(error)}`);
    }
    throw new CameraApiError(friendlyMessage(undefined, undefined, true));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export { previewableImageUri };
