import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import {
  listHistory,
  getHistoryInsightsSummary,
  hideHistoryDoseController,
} from '../controllers/historyController';

const router = Router();

router.use(requireAuth);
router.post('/hide', hideHistoryDoseController);
router.get('/insights', getHistoryInsightsSummary);
router.get('/', listHistory);

export default router;
