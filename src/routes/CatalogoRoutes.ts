import { Router } from 'express';
const router = Router();

import { actualizarMantenimientoCatalogo, crearMantenimientoCatalogo, eliminarMantenimientoCatalogo, getMantenimientoCatalogoById, getMantenimientosCatalogo, seedCatalogo } from '../controllers/CatalogoControllers';
import checkAuth from '../middlewares/checkAuth';
import requireAdmin from '../middlewares/requireAdmin';

// Crear nuevo mantenimiento (catalogo)
router.post('/', checkAuth, requireAdmin, crearMantenimientoCatalogo);
router.get('/', checkAuth, requireAdmin, getMantenimientosCatalogo);

router.route('/:id')
  .get(checkAuth, requireAdmin, getMantenimientoCatalogoById)
  .put(checkAuth, requireAdmin, actualizarMantenimientoCatalogo)
  .delete(checkAuth, requireAdmin, eliminarMantenimientoCatalogo);

router.post('/seed', checkAuth, requireAdmin, seedCatalogo);


export default router;
