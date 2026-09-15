import Router from 'express';
const router = Router();

import { seedCatalogo } from '../controllers/CatalogoControllers';

// Seed del catálogo de vehículos (sin auth para ejecutarlo directo desde el navegador).
router.get('/seed', seedCatalogo);


export default router;
