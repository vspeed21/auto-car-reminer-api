import Router from 'express';
const router = Router();

import { actualizarMantenimiento, actualizarMantenimientoLista, crearMantenimientoLista, crearMantenimientoVehiculo, eliminarMantenimiento, getMantenimientoListaById, getMantenimientos, getMantenimientosLista, getMisMantenimientos, obtenerMantenimientosProximos, seedMantenimientosLista } from '../controllers/MantenimientoControllers';
import checkAuth from '../middlewares/checkAuth';

// Private Routes
router.post('/', checkAuth, crearMantenimientoVehiculo);
router.get('/', checkAuth, getMisMantenimientos);
router.get('/test', checkAuth, obtenerMantenimientosProximos);
// Catálogo mantenimientos_lista: lecturas públicas, escritura con token (igual que el resto).
router.get('/lista', getMantenimientosLista);
router.get('/lista/seed', seedMantenimientosLista);
router.get('/lista/:id', getMantenimientoListaById);
router.post('/lista', checkAuth, crearMantenimientoLista);
router.put('/lista/:id', checkAuth, actualizarMantenimientoLista);
router.get('/:id', getMantenimientos);
router.put('/:id', checkAuth, actualizarMantenimiento);
router.delete('/:id', checkAuth, eliminarMantenimiento);


export default router;
