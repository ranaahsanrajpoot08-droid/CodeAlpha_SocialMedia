import { Router } from 'express';
import {
  getComments,
  addComment,
  deleteComment,
  likeComment,
  unlikeComment,
} from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

// This router is mounted at "/api", so the paths below are full API paths.
const router = Router();

router.get('/posts/:postId/comments', protect, getComments); //    GET    /api/posts/:postId/comments
router.post('/posts/:postId/comments', protect, addComment); //    POST   /api/posts/:postId/comments  (body: comment, parentId?)
router.delete('/comments/:id', protect, deleteComment); //         DELETE /api/comments/:id
router.post('/comments/:id/like', protect, likeComment); //        POST   /api/comments/:id/like
router.delete('/comments/:id/like', protect, unlikeComment); //    DELETE /api/comments/:id/like

export default router;
