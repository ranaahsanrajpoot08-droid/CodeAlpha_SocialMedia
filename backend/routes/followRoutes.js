import { Router } from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
} from '../controllers/followController.js';
import { protect } from '../middleware/authMiddleware.js';

// Mounted at "/api"
const router = Router();

router.post('/users/:id/follow', protect, followUser); // POST   /api/users/:id/follow
router.delete('/users/:id/follow', protect, unfollowUser); // DELETE /api/users/:id/follow
router.get('/users/:id/follow-status', protect, getFollowStatus); // GET    /api/users/:id/follow-status
router.get('/users/:id/followers', protect, getFollowers); // GET    /api/users/:id/followers
router.get('/users/:id/following', protect, getFollowing); // GET    /api/users/:id/following

export default router;
