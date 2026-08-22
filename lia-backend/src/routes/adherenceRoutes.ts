import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getAdherenceSummary } from '../controllers/historyController';

const router = Router();

router.use(requireAuth);
router.get('/', getAdherenceSummary);

export default router;
