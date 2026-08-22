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
 * Reporte desde ESP32-CAM (resultado ya reconocido en dispositivo).
 * SIN JWT de usuario; auth de dispositivo vía esp32Middleware si aplica.
 */
router.post('/device-result', esp32Middleware, reportDeviceResult);

/** Sesiones creadas/consultadas por la app (JWT). */
router.use(requireAuth);
router.post('/sessions', createCameraSession);
router.get('/sessions/:id', getCameraSession);

export default router;
