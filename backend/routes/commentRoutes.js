import { Router } from 'express';
import { getComments, addComment, deleteComment } from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

// This router is mounted at "/api", so the paths below are full API paths.
const router = Router();

router.get('/posts/:postId/comments', protect, getComments); // GET    /api/posts/:postId/comments
router.post('/posts/:postId/comments', protect, addComment); // POST   /api/posts/:postId/comments
router.delete('/comments/:id', protect, deleteComment); // DELETE /api/comments/:id

export default router;
