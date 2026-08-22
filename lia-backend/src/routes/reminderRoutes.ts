import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { listReminders } from '../controllers/reminderController';

const router = Router();

router.use(requireAuth);
router.get('/', listReminders);

export default router;
