import Router from 'express';
const router = Router();

import { getMe, logInUser, SignUp } from '../controllers/AuthControllers';
import checkAuth from '../middlewares/checkAuth';
import { authLimiter } from '../middlewares/rateLimit';

// Private Routes
router.get('/me', checkAuth, getMe);
router.post('/login', authLimiter, logInUser);
router.post('/signup', authLimiter, SignUp);


export default router;
