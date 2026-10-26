import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getConversations,
  getUnreadCount,
  getMessages,
  sendMessage,
  forwardMessage,
  deleteMessage,
  reactToMessage,
  clearChat,
  markRead,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMessageAttachment } from '../middleware/uploadMiddleware.js';

const router = Router();

// Max 30 sends per minute per user (counted by user id, not IP).
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

// NOTE: fixed words ("conversations", "forward", "item", "chat" ...) must come BEFORE "/:userId".
router.get('/conversations', getConversations); //                    GET    /api/messages/conversations
router.get('/unread-count', getUnreadCount); //                       GET    /api/messages/unread-count
router.post('/forward', sendLimiter, forwardMessage); //              POST   /api/messages/forward
router.delete('/chat/:userId', clearChat); //                         DELETE /api/messages/chat/:userId
router.delete('/item/:messageId', deleteMessage); //                  DELETE /api/messages/item/:messageId?scope=me|everyone
router.put('/item/:messageId/reaction', reactToMessage); //           PUT    /api/messages/item/:messageId/reaction

router.get('/:userId', getMessages); //                               GET    /api/messages/:userId
router.post('/:userId', sendLimiter, uploadMessageAttachment, sendMessage); // POST /api/messages/:userId (text or file)
router.patch('/:userId/read', markRead); //                           PATCH  /api/messages/:userId/read

export default router;
