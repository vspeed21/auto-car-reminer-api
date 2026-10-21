import { Router } from 'express';
const router = Router();

import { actualizarMarca, crearMarca, getMarcaById, getMarcas } from '../controllers/MarcasControllers';
import checkAuth from '../middlewares/checkAuth';

// Lecturas públicas, escritura con token (igual que el catálogo).
router.get('/', getMarcas);
router.get('/:id', getMarcaById);
router.post('/', checkAuth, crearMarca);
router.put('/:id', checkAuth, actualizarMarca);


export default router;
