import { Router } from 'express';
import { getNote, getNotes, reindexNote, uploadAndAnalyze } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';
import { uploadPdf } from '../middleware/upload.js';

const router = Router();

router.use(protect);
router.post('/pdf', uploadPdf, uploadAndAnalyze);
router.get('/notes', getNotes);
router.post('/notes/:id/reindex', reindexNote);
router.get('/notes/:id', getNote);

export default router;
