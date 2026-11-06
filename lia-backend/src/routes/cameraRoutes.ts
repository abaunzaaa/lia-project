import { Router, raw } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth';
import {
  createCameraSession,
  getCameraSession,
} from '../controllers/cameraSessionController';
import { reportDeviceResult } from '../controllers/cameraDeviceResultController';
import { reportDevicePhoto } from '../controllers/cameraDevicePhotoController';
import { recognizeMobilePhoto } from '../controllers/cameraMobilePhotoController';
import { esp32Middleware } from '../middleware';

const router = Router();

const mobileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  },
});

function rejectMobileUpload(error: unknown) {
  const tooLarge =
    error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
  return {
    status: 400,
    body: {
      error: 'Imagen inválida',
      message: tooLarge
        ? 'La foto es demasiado grande. Acerca menos el medicamento e inténtalo otra vez.'
        : 'La fotografía no es válida. Vuelve a tomarla con buena luz.',
    },
  };
}

/**
 * Foto JPEG desde ESP32-CAM.
 * SIN JWT de usuario; auth de dispositivo vía X-Device-Token si ESP32_DEVICE_TOKEN está definido.
 */
router.post(
  '/device-photo',
  esp32Middleware,
  raw({ type: ['image/jpeg', 'image/jpg', 'application/octet-stream'], limit: '8mb' }),
  reportDevicePhoto
);

/**
 * Reporte desde ESP32 de audio (copia del texto ya hablado).
 * SIN JWT de usuario; auth de dispositivo vía X-Device-Token si ESP32_DEVICE_TOKEN está definido.
 */
router.post('/device-result', esp32Middleware, reportDeviceResult);

/** Sesiones creadas/consultadas por la app (JWT). */
router.use(requireAuth);
router.post('/sessions', createCameraSession);
router.get('/sessions/:id', getCameraSession);

/**
 * Foto de la cámara del celular.
 * JWT de la app. No usa X-Device-Id ni la sesión de la ESP32.
 */
router.post('/mobile-photo', (req, res, next) => {
  mobileUpload.single('image')(req, res, (error: unknown) => {
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        const code = error instanceof multer.MulterError ? error.code : 'invalid';
        console.warn(`[camera-mobile-photo] upload rejected ${code}`);
      }
      const rejected = rejectMobileUpload(error);
      return res.status(rejected.status).json(rejected.body);
    }
    return next();
  });
}, recognizeMobilePhoto);

export default router;
