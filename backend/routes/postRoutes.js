import { Router } from 'express';
import { getPosts, getPostById, createPost, updatePost, deletePost } from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadPostImage } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getPosts); // GET    /api/posts
router.get('/:id', getPostById); // GET    /api/posts/:id
router.post('/', uploadPostImage, createPost); // POST   /api/posts
router.put('/:id', uploadPostImage, updatePost); // PUT    /api/posts/:id
router.delete('/:id', deletePost); // DELETE /api/posts/:id

export default router;
