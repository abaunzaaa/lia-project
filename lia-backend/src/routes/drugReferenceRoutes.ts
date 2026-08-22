import { Router } from 'express';
import {
  searchDrugs,
  getDrugInfo,
  chatAboutMedication,
} from '../controllers/drugReferenceController';

const router = Router();

router.get('/search', searchDrugs);
router.get('/info', getDrugInfo);
router.post('/chat', chatAboutMedication);

export default router;
