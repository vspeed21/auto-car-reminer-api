import Router from 'express';
const router = Router();

import { actualizarModelo, crearModelo, getModeloById, getModelos } from '../controllers/ModelosControllers';
import checkAuth from '../middlewares/checkAuth';

// Lecturas públicas, escritura con token (igual que el catálogo).
// GET / admite ?marcaId= para listar los modelos de una marca.
router.get('/', getModelos);
router.get('/:id', getModeloById);
router.post('/', checkAuth, crearModelo);
router.put('/:id', checkAuth, actualizarModelo);


export default router;
