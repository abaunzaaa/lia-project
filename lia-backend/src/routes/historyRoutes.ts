import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { listHistory, getHistoryInsightsSummary } from '../controllers/historyController';

const router = Router();

router.use(requireAuth);
// /insights antes de cualquier /:id futuro
router.get('/insights', getHistoryInsightsSummary);
router.get('/', listHistory);

export default router;
