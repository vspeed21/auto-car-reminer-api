import Router from 'express';
const router = Router();

import { agregarVehiculo, getVehiculos, sumarKilometraje, updateVehiculo } from '../controllers/VehiculosControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
router.post('/', checkAuth, agregarVehiculo);
router.get('/', checkAuth, getVehiculos);
router.put('/:id', checkAuth, updateVehiculo);
router.patch('/:id/kilometraje', checkAuth, sumarKilometraje);


export default router;

