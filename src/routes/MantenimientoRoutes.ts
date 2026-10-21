import { Router } from 'express';
const router = Router();

import { actualizarMantenimiento, crearMantenimientoVehiculo, eliminarMantenimiento, getMisMantenimientos, seedMantenimientosLista } from '../controllers/MantenimientoControllers';
import checkAuth from '../middlewares/checkAuth';
import requireAdmin from '../middlewares/requireAdmin';

// Private Routes
router.post('/', checkAuth, crearMantenimientoVehiculo);
router.get('/:vehiculoId', checkAuth, getMisMantenimientos);

// Seed administrativo: requiere token + UID en ADMIN_UIDS.
router.post('/lista/seed', checkAuth, requireAdmin, seedMantenimientosLista);

// Actualizar información del mantenimiento segun usuario logueado
router.put('/:id', checkAuth, actualizarMantenimiento);

// Eliminar mantenimiento de un vehículo
router.delete('/:id', checkAuth, eliminarMantenimiento);


export default router;
