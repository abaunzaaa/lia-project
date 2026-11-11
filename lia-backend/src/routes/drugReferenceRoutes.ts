import { Router } from 'express';
import {
  searchDrugs,
  getDrugInfo,
  chatAboutMedication,
} from '../controllers/drugReferenceController';
import { chatAboutAccountMedications } from '../controllers/accountMedicationChatController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/search', searchDrugs);
router.get('/info', getDrugInfo);
router.post('/chat', chatAboutMedication);
router.post('/account-chat', requireAuth, chatAboutAccountMedications);

export default router;
