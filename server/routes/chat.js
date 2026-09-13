import { Router } from 'express';
import { getHistory, sendMessage } from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.get('/history', getHistory);
router.post('/message', sendMessage);

export default router;
