import { Router } from 'express';
import multer from 'multer';
import {
  recognizeMedication,
  chatWithLIA,
  getMedicationInfo,
  healthCheck,
} from '../controllers/medicationController';
import { authMiddleware, esp32Middleware } from '../middleware';
import authRoutes from './authRoutes';
import medicationCrudRoutes from './medicationCrudRoutes';
import reminderRoutes from './reminderRoutes';
import intakeRoutes from './intakeRoutes';
import historyRoutes from './historyRoutes';
import adherenceRoutes from './adherenceRoutes';
import drugReferenceRoutes from './drugReferenceRoutes';
import cameraRoutes from './cameraRoutes';

const router = Router();

// Autenticación real (PostgreSQL / JWT) — independiente del modo demo
router.use('/auth', authRoutes);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  },
});

// Health check
router.get('/health', healthCheck);

// --- Rutas IA / ESP32 / catálogo (modo demo intacto) ---
// Deben declararse ANTES del CRUD con /:id

router.post(
  '/medications/recognize',
  authMiddleware,
  esp32Middleware,
  upload.single('image'),
  recognizeMedication
);

router.post('/medications/chat', authMiddleware, chatWithLIA);

router.get('/medications/info', getMedicationInfo);

// --- CRUD real de medicamentos (JWT obligatorio) ---
router.use('/medications', medicationCrudRoutes);

// --- Recordatorios, tomas, historial y adherencia (JWT obligatorio) ---
router.use('/reminders', reminderRoutes);
router.use('/intakes', intakeRoutes);
router.use('/history', historyRoutes);
router.use('/adherence', adherenceRoutes);

// --- Referencia farmacológica (RxNorm / openFDA / DailyMed) ---
router.use('/drug-reference', drugReferenceRoutes);

// --- Sesiones de cámara (ESP32 ↔ app, JWT obligatorio) ---
router.use('/camera', cameraRoutes);

export default router;
