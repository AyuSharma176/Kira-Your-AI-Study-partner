import { Router } from 'express';
import { getNote, getNotes, reindexNote, uploadAndAnalyze } from '../controllers/uploadController.js';
import { handleClientUploadRequest } from '../controllers/blobController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

function protectBlobTokenRequest(req, res, next) {
  if (req.body?.type === 'blob.generate-client-token') return protect(req, res, next);
  return next();
}

router.post('/blob', protectBlobTokenRequest, handleClientUploadRequest);
router.use(protect);
router.post('/pdf', uploadAndAnalyze);
router.get('/notes', getNotes);
router.post('/notes/:id/reindex', reindexNote);
router.get('/notes/:id', getNote);

export default router;
