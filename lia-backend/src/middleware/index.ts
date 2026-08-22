import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/** Autenticación opcional vía token Firebase */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // Modo demo: permitir acceso sin auth en desarrollo
    (req as Request & { userId?: string }).userId = 'demo';
    return next();
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    // Cuando Firebase Admin esté configurado, verificar token aquí
    (req as Request & { userId?: string }).userId = 'authenticated';
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Validación de origen para ESP32-CAM.
 * Si ESP32_DEVICE_TOKEN está definido, exige header X-Device-Token coincidente.
 * Si no está definido, no bloquea (compatibilidad).
 */
export function esp32Middleware(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers['x-device-id'];
  const deviceId = Array.isArray(raw) ? raw[0] : raw;
  if (deviceId && String(deviceId).trim()) {
    console.log(`📡 Solicitud desde ESP32-CAM: ${String(deviceId).trim()}`);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn('[esp32] X-Device-Id ausente en recognize');
  }

  const expected = config.esp32DeviceToken?.trim();
  if (expected) {
    const provided = String(req.headers['x-device-token'] ?? '').trim();
    if (!provided || provided !== expected) {
      return res.status(401).json({
        error: 'No autorizado',
        message: 'X-Device-Token inválido o ausente.',
      });
    }
  }

  next();
}

/** Manejo global de errores */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor', message: err.message });
}
