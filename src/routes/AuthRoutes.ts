import Router from 'express';
const router = Router();

import { getMe, logInUser, SignUp } from '../controllers/AuthControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
router.get('/me', checkAuth, getMe);
router.post('/login', logInUser);
router.post('/signup', SignUp);
// router.put('/:id', updateVehiculo);


export default router;
