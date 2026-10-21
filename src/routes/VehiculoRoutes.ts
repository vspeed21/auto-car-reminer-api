import { Router } from 'express';
const router = Router();

import { agregarVehiculo, eliminarVehiculo, getVehiculos, sumarKilometraje, updateVehiculo } from '../controllers/VehiculosControllers';
import checkAuth from '../middlewares/checkAuth';

// Crear vehiculos
router.post('/', checkAuth, agregarVehiculo);

// Obtener lista de vehiculos segun usuario registrado.
router.get('/', checkAuth, getVehiculos);

// Actualizar información del vehiculo segun usuario registrado
router.put('/:id', checkAuth, updateVehiculo);

// Eliminar vehiculo segun usuario registrado
router.delete('/:id', checkAuth, eliminarVehiculo);

// Actualizar kilometraje del vehiculo segun usuario registrado
router.patch('/:id/kilometraje', checkAuth, sumarKilometraje);


export default router;

