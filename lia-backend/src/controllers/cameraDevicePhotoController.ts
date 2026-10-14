import { Request, Response } from 'express';
import {
  attachImageToLatestWaitingSession,
} from '../services/cameraSessionService';
import {
  CameraImageError,
  saveCameraJpeg,
} from '../services/cameraImageService';

function headerDeviceId(req: Request): string | undefined {
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

function readJpegBody(req: Request): Buffer | null {
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    return req.body;
  }
  return null;
}

/**
 * POST /api/camera/device-photo
 * La ESP32-CAM envía el JPEG crudo (Content-Type: image/jpeg).
 * Se adjunta a la sesión waiting más reciente de ese deviceId.
 */
export async function reportDevicePhoto(req: Request, res: Response) {
  try {
    const deviceId = (headerDeviceId(req) || '').trim();
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId es obligatorio.',
      });
    }

    const buffer = readJpegBody(req);
    if (!buffer) {
      return res.status(400).json({
        success: false,
        message: 'Imagen requerida.',
      });
    }

    const imageUrl = await saveCameraJpeg(buffer);
    const sessionId = await attachImageToLatestWaitingSession({
      deviceId,
      imageUrl,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-device-photo] deviceId=${deviceId} bytes=${buffer.length} session=${sessionId || '(none)'}`
      );
    }

    return res.status(200).json({
      success: true,
      matched: Boolean(sessionId),
      sessionId: sessionId ?? null,
      imageUrl,
    });
  } catch (error) {
    if (error instanceof CameraImageError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    console.error(
      '[camera-device-photo]',
      error instanceof Error ? error.message : 'error'
    );
    return res.status(500).json({
      success: false,
      message: 'No se pudo guardar la foto de la cámara.',
    });
  }
}
