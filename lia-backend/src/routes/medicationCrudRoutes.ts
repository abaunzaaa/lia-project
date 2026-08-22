import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import {
  listMedications,
  createMedication,
  getMedication,
  updateMedication,
  deleteMedication,
} from '../controllers/medicationCrudController';

const router = Router();

// Todas las rutas CRUD requieren JWT real (no middleware demo)
router.use(requireAuth);

router.get('/', listMedications);
router.post('/', createMedication);
router.get('/:id', getMedication);
router.put('/:id', updateMedication);
router.delete('/:id', deleteMedication);

export default router;
