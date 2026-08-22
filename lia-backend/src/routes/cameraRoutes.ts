import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import {
  createCameraSession,
  getCameraSession,
} from '../controllers/cameraSessionController';
import { reportDeviceResult } from '../controllers/cameraDeviceResultController';
import { esp32Middleware } from '../middleware';

const router = Router();

/**
 * Reporte desde ESP32 de audio (copia del texto ya hablado).
 * SIN JWT de usuario; auth de dispositivo vía X-Device-Token si ESP32_DEVICE_TOKEN está definido.
 */
router.post('/device-result', esp32Middleware, reportDeviceResult);

/** Sesiones creadas/consultadas por la app (JWT). */
router.use(requireAuth);
router.post('/sessions', createCameraSession);
router.get('/sessions/:id', getCameraSession);

export default router;
