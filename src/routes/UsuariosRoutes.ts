import { Router } from 'express';
const router = Router();

import { getUserStats, updateUserConfig, updateTokenUser, getCurrentUserInfo } from '../controllers/UsuariosControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
router.patch('/token', checkAuth, updateTokenUser);
router.patch('/config', checkAuth, updateUserConfig);
router.get('/info', checkAuth, getCurrentUserInfo);
router.get('/stats', checkAuth, getUserStats);


export default router;
