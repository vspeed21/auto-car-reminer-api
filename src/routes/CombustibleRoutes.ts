import Router from 'express';
const router = Router();

import { crearTanqueada, eliminarTanqueada, getTanqueadas } from '../controllers/CombustibleControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
// GET / admite ?vehiculoId= para filtrar por vehículo.
router.post('/', checkAuth, crearTanqueada);
router.get('/', checkAuth, getTanqueadas);
router.delete('/:id', checkAuth, eliminarTanqueada);


export default router;
