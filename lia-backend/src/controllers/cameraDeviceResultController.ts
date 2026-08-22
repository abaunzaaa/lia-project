import { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { getDrugInfo, DrugReferenceError } from '../services/drugReferenceService';
import { PatientDrugInfo } from '../models/drugReferenceTypes';
import {
  markLatestWaitingSessionRecognized,
} from '../services/cameraSessionService';
import { parseCameraDeviceRaw } from '../utils/parseCameraDeviceRaw';

const deviceResultSchema = z
  .object({
    rawResult: z.string().max(8000).optional(),
    voiceText: z.string().max(8000).optional(),
    medicationName: z.string().max(200).optional(),
  })
  .refine((body) => Boolean(body.rawResult?.trim() || body.medicationName?.trim()), {
    message: 'rawResult es obligatorio.',
  });

function extractDeviceId(req: Request): string | undefined {
  const raw = req.headers['x-device-id'];
  if (Array.isArray(raw)) {
    const first = raw[0]?.trim();
    return first || undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  return undefined;
}

/**
 * POST /api/camera/device-result
 * La ESP32-CAM reporta el texto bruto de Gemini. El backend interpreta y completa la sesión.
 */
export async function reportDeviceResult(req: Request, res: Response) {
  try {
    const deviceId = extractDeviceId(req);
    if (!deviceId) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[camera-device-result] deviceId=(missing)');
      }
      return res.status(400).json({
        success: false,
        message: 'Header X-Device-Id es obligatorio.',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[camera-device-result] received deviceId=${deviceId}`);
    }

    const parsedBody = deviceResultSchema.parse(req.body ?? {});
    const rawResult = parsedBody.rawResult?.trim() || '';
    const hasRaw = rawResult.length > 0;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[camera-device-result] raw-result-received=${hasRaw}`);
    }

    const fromRaw = hasRaw
      ? parseCameraDeviceRaw(rawResult)
      : { medicationName: null, voiceText: null };

    const voiceText = (
      parsedBody.voiceText?.trim() ||
      rawResult ||
      fromRaw.voiceText ||
      ''
    ).trim();
    const medicationName = (
      fromRaw.medicationName ||
      parsedBody.medicationName?.trim() ||
      ''
    ).trim();

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-device-result] parsed medicationName=${medicationName || '(none)'}`
      );
    }

    if (!voiceText) {
      return res.status(200).json({
        success: true,
        matched: false,
        sessionId: null,
        reason: 'empty_result',
      });
    }

    let patientInfo: PatientDrugInfo | null = null;
    let rxcui: string | null = null;

    if (medicationName && !/^NO_IDENTIFICADO$/i.test(medicationName)) {
      try {
        patientInfo = await getDrugInfo({ name: medicationName });
        rxcui = patientInfo.id;
      } catch (error) {
        if (!(error instanceof DrugReferenceError)) {
          console.error(
            '[camera-device-result:drug-reference]',
            error instanceof Error ? error.message : 'error'
          );
        }
      }
    }

    try {
      const sessionId = await markLatestWaitingSessionRecognized({
        deviceId,
        medicationName: medicationName || null,
        rxcui,
        patientInfo,
        voiceText,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[camera-device-result] session found=${Boolean(sessionId)}`);
        if (sessionId) {
          console.log(`[camera-device-result] completed sessionId=${sessionId}`);
        }
      }

      return res.status(200).json({
        success: true,
        matched: Boolean(sessionId),
        sessionId: sessionId ?? null,
      });
    } catch (error) {
      console.error(
        '[camera-session:complete:error]',
        error instanceof Error ? error.message : 'error'
      );
      return res.status(500).json({
        success: false,
        message: 'No se pudo actualizar la sesión de cámara.',
      });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues.map((i) => i.message).join(' '),
      });
    }
    console.error(
      '[camera-device-result]',
      error instanceof Error ? error.message : 'error'
    );
    return res.status(500).json({
      success: false,
      message: 'Error interno al reportar el resultado.',
    });
  }
}
