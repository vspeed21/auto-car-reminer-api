import Router from 'express';
const router = Router();

import { getRecordatorios } from '../controllers/RecordatoriosControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
router.get('/', checkAuth, getRecordatorios);


export default router;
