import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getConversations,
  getUnreadCount,
  getMessages,
  sendMessage,
  markRead,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// Max 30 messages per minute per user (counted by user id, not IP).
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `user-${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) =>
    res.status(429).json({ success: false, message: 'You are sending messages too fast. Please wait a moment.' }),
});

router.use(protect); // every route needs a logged-in user

// NOTE: fixed words ("conversations", "unread-count") must come BEFORE "/:userId".
router.get('/conversations', getConversations); // GET   /api/messages/conversations
router.get('/unread-count', getUnreadCount); //     GET   /api/messages/unread-count
router.get('/:userId', getMessages); //             GET   /api/messages/:userId
router.post('/:userId', sendLimiter, sendMessage); // POST  /api/messages/:userId
router.patch('/:userId/read', markRead); //         PATCH /api/messages/:userId/read

export default router;
