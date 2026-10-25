import { Router } from 'express';
import { likePost, unlikePost, getPostLikes } from '../controllers/likeController.js';
import { protect } from '../middleware/authMiddleware.js';

// Mounted at "/api"
const router = Router();

router.post('/posts/:postId/like', protect, likePost); // POST   /api/posts/:postId/like
router.delete('/posts/:postId/like', protect, unlikePost); // DELETE /api/posts/:postId/like
router.get('/posts/:postId/likes', protect, getPostLikes); // GET    /api/posts/:postId/likes

export default router;
