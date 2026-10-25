import { Router } from 'express';
import { getUserById, updateUser, searchUsers, getSuggestedUsers } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadProfileImage } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(protect); // every route below needs a logged-in user

// NOTE: "/search" and "/suggestions" must come BEFORE "/:id",
// otherwise Express would think "search" is an id.
router.get('/search', searchUsers); // GET /api/users/search?q=ali
router.get('/suggestions', getSuggestedUsers); // GET /api/users/suggestions
router.get('/:id', getUserById); // GET /api/users/:id
router.put('/:id', uploadProfileImage, updateUser); // PUT /api/users/:id

export default router;
