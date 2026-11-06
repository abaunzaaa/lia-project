import { Request, Response } from 'express';
import { AiProviderError } from '../services/aiService';
import { CameraImageError, deleteCameraImage, saveCameraJpeg } from '../services/cameraImageService';
import { recognizeAndEnrichMedicationImage } from '../services/medicationRecognitionService';

function friendlyImageMessage(error: CameraImageError): string {
  if (/demasiado grande/i.test(error.message)) {
    return 'La foto es demasiado grande. Acerca menos el medicamento e inténtalo otra vez.';
  }
  return 'La fotografía no es válida. Vuelve a tomarla con buena luz.';
}

/**
 * POST /api/camera/mobile-photo
 * Foto JPEG de la cámara del celular, autenticada con el JWT de la app.
 * Reutiliza recognizeAndEnrichMedicationImage. No usa deviceId ni sesiones ESP32.
 */
export async function recognizeMobilePhoto(req: Request, res: Response) {
  let imageUrl: string | null = null;
  try {
    const buffer = req.file?.buffer;
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        error: 'Imagen requerida',
        message: 'No recibimos la fotografía. Vuelve a tomarla.',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-mobile-photo] bytes=${buffer.length} type=${req.file?.mimetype ?? 'none'}`
      );
    }

    try {
      imageUrl = await saveCameraJpeg(buffer);
    } catch (error) {
      if (error instanceof CameraImageError) {
        return res.status(error.statusCode).json({
          error: 'Imagen inválida',
          message: friendlyImageMessage(error),
        });
      }
      console.error(
        '[camera-mobile-photo:save-image]',
        error instanceof Error ? error.message : 'error'
      );
    }

    const started = Date.now();
    const payload = await recognizeAndEnrichMedicationImage(buffer);
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-mobile-photo] done ms=${Date.now() - started} bytes=${buffer.length} identified=${payload.identified}`
      );
    }
    if (!payload.identified && imageUrl) {
      await deleteCameraImage(imageUrl);
      imageUrl = null;
    }

    return res.json({
      ...payload,
      imageUrl,
    });
  } catch (error) {
    if (imageUrl) {
      await deleteCameraImage(imageUrl);
    }
    if (error instanceof AiProviderError) {
      if (error.kind === 'not_configured') {
        return res.status(503).json({
          error: 'IA no configurada',
          message: 'El reconocimiento no está disponible en este momento.',
        });
      }
      if (error.kind === 'timeout') {
        return res.status(504).json({
          error: 'Timeout',
          message: 'El reconocimiento tardó demasiado. Inténtalo de nuevo.',
        });
      }
      if (error.httpStatus === 429) {
        return res.status(503).json({
          error: 'Límite de IA',
          message:
            'El reconocimiento está recibiendo muchas consultas. Espera un momento e inténtalo de nuevo.',
        });
      }
      return res.status(502).json({
        error: 'Error de reconocimiento',
        message: 'No se pudo procesar la imagen. Inténtalo de nuevo.',
      });
    }

    console.error(
      '[camera-mobile-photo]',
      error instanceof Error ? error.message : 'error'
    );
    return res.status(500).json({
      error: 'Error al procesar la imagen',
      message: 'No pudimos reconocer el medicamento. Inténtalo de nuevo.',
    });
  }
}
