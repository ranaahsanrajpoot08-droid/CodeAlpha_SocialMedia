import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register); // POST /api/auth/register
router.post('/login', login); // POST /api/auth/login
router.get('/me', protect, getMe); // GET  /api/auth/me

export default router;
