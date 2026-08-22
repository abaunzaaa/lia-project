import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { createOrUpdateIntake } from '../controllers/intakeController';

const router = Router();

router.use(requireAuth);
router.post('/', createOrUpdateIntake);

export default router;
