import { Response } from 'express';
import { ZodError, z } from 'zod';
import { AuthenticatedRequest } from '../middleware/requireAuth';
import * as cameraSessionService from '../services/cameraSessionService';
import { CameraSessionError } from '../services/cameraSessionService';

const createSessionSchema = z.object({
  deviceId: z
    .string({ error: 'deviceId es obligatorio.' })
    .trim()
    .min(1, 'deviceId es obligatorio.')
    .max(120, 'deviceId es demasiado largo.'),
});

function getUserId(req: AuthenticatedRequest): string | null {
  return req.auth?.userId ?? null;
}

/** POST /api/camera/sessions */
export async function createCameraSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const { deviceId } = createSessionSchema.parse(req.body);
    const session = await cameraSessionService.createWaitingSession({ userId, deviceId });

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-session:create] sessionId=${session.id} deviceId=${session.deviceId} status=${session.status}`
      );
    }

    return res.status(201).json({
      id: session.id,
      status: session.status,
      expiresAt: session.expiresAt,
      deviceId: session.deviceId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues.map((i) => i.message).join(' '),
      });
    }
    if (error instanceof CameraSessionError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[camera:create]', error instanceof Error ? error.message : 'error');
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear la sesión de cámara.',
    });
  }
}

/** GET /api/camera/sessions/:id */
export async function getCameraSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const sessionId = String(req.params.id || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'id de sesión requerido.' });
    }

    const poll = await cameraSessionService.getSessionForUser({ userId, sessionId });
    return res.status(200).json(poll);
  } catch (error) {
    if (error instanceof CameraSessionError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[camera:get]', error instanceof Error ? error.message : 'error');
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar la sesión de cámara.',
    });
  }
}
