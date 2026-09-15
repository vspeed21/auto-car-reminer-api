import Router from 'express';
const router = Router();

import { agregarVehiculo, getVehiculos, updateVehiculo } from '../controllers/VehiculosControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
router.post('/', checkAuth, agregarVehiculo);
router.get('/', checkAuth, getVehiculos);
router.put('/:id', checkAuth, updateVehiculo);


export default router;

