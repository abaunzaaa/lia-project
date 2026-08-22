import { pool } from '../config/database';
import { PatientDrugInfo } from '../models/drugReferenceTypes';

export class CameraSessionError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'CameraSessionError';
  }
}

export type CameraSessionStatus = 'waiting' | 'recognized' | 'expired';

export interface CameraSessionCreated {
  id: string;
  status: CameraSessionStatus;
  expiresAt: string;
  deviceId: string;
}

export interface CameraSessionPollWaiting {
  status: 'waiting';
}

export interface CameraSessionPollRecognized {
  status: 'recognized';
  result: {
    name: string;
    rxcui: string | null;
    patientInfo: PatientDrugInfo | null;
    voiceText?: string | null;
  };
}

export interface CameraSessionPollExpired {
  status: 'expired';
}

export type CameraSessionPollResult =
  | CameraSessionPollWaiting
  | CameraSessionPollRecognized
  | CameraSessionPollExpired;

interface SessionRow {
  id: string;
  user_id: string;
  device_id: string;
  status: CameraSessionStatus;
  medication_name: string | null;
  rxcui: string | null;
  patient_info: PatientDrugInfo | null;
  voice_text: string | null;
  expires_at: Date;
}

const SESSION_TTL_MS = 5 * 60 * 1000;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function createWaitingSession(params: {
  userId: string;
  deviceId: string;
}): Promise<CameraSessionCreated> {
  const deviceId = params.deviceId.trim();
  if (!deviceId) {
    throw new CameraSessionError(400, 'deviceId es obligatorio.');
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const result = await pool.query<SessionRow>(
    `
    INSERT INTO public.camera_recognition_sessions (
      user_id, device_id, status, expires_at, created_at, updated_at
    ) VALUES (
      $1, $2, 'waiting', $3, NOW(), NOW()
    )
    RETURNING
      id,
      user_id,
      device_id,
      status,
      medication_name,
      rxcui,
      patient_info,
      voice_text,
      expires_at
    `,
    [params.userId, deviceId, expiresAt]
  );

  const row = result.rows[0];
  if (!row) {
    throw new CameraSessionError(500, 'No se pudo crear la sesión de cámara.');
  }

  return {
    id: row.id,
    status: row.status,
    expiresAt: toIso(row.expires_at),
    deviceId: row.device_id,
  };
}

export async function getSessionForUser(params: {
  userId: string;
  sessionId: string;
}): Promise<CameraSessionPollResult> {
  const result = await pool.query<SessionRow>(
    `
    SELECT
      id,
      user_id,
      device_id,
      status,
      medication_name,
      rxcui,
      patient_info,
      voice_text,
      expires_at
    FROM public.camera_recognition_sessions
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [params.sessionId, params.userId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new CameraSessionError(404, 'Sesión de cámara no encontrada.');
  }

  const now = Date.now();
  const expiresAtMs = new Date(row.expires_at).getTime();

  if (row.status === 'waiting' && expiresAtMs < now) {
    await pool.query(
      `
      UPDATE public.camera_recognition_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE id = $1
        AND status = 'waiting'
      `,
      [row.id]
    );
    return { status: 'expired' };
  }

  if (row.status === 'expired') {
    return { status: 'expired' };
  }

  if (row.status === 'waiting') {
    return { status: 'waiting' };
  }

  return {
    status: 'recognized',
    result: {
      name: row.medication_name ?? '',
      rxcui: row.rxcui,
      patientInfo: row.patient_info,
      voiceText: row.voice_text,
    },
  };
}

export async function markLatestWaitingSessionRecognized(params: {
  deviceId: string;
  medicationName: string | null;
  rxcui: string | null;
  patientInfo: PatientDrugInfo | null;
  voiceText: string | null;
}): Promise<string | null> {
  const deviceId = params.deviceId.trim();
  if (!deviceId) return null;

  const result = await pool.query<{ id: string }>(
    `
    UPDATE public.camera_recognition_sessions
    SET
      status = 'recognized',
      medication_name = $2,
      rxcui = $3,
      patient_info = $4::jsonb,
      voice_text = $5,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM public.camera_recognition_sessions
      WHERE device_id = $1
        AND status = 'waiting'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING id
    `,
    [
      deviceId,
      params.medicationName,
      params.rxcui,
      params.patientInfo ? JSON.stringify(params.patientInfo) : null,
      params.voiceText,
    ]
  );

  return result.rows[0]?.id ?? null;
}

export async function expireLatestWaitingSession(deviceId: string): Promise<string | null> {
  const trimmed = deviceId.trim();
  if (!trimmed) return null;

  const result = await pool.query<{ id: string }>(
    `
    UPDATE public.camera_recognition_sessions
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM public.camera_recognition_sessions
      WHERE device_id = $1
        AND status = 'waiting'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING id
    `,
    [trimmed]
  );

  return result.rows[0]?.id ?? null;
}
