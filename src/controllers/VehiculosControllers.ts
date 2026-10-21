import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

export async function agregarVehiculo(req: Request, res: Response) {
  // Campos de body para crear un vehiculo
  const { marca, modelo, year, placa, kilometraje, tipo, cilindraje } = req.body;

  // Validar que todos los campos requeridos hayan sido enviados
  if (!marca || !modelo || !year || !placa || !kilometraje) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos como: marca, modelo, año, placa o kilometraje'
    });
    return;
  }

  // Tipo de vehículo: automovil por defecto, moto como alternativa.
  const tiposPermitidos = ['automovil', 'moto'];
  const tipoVehiculo = tipo ? String(tipo).toLowerCase() : 'automovil';

  if (!tiposPermitidos.includes(tipoVehiculo)) {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'El tipo de vehículo debe ser automovil o moto'
    });
    return;
  }

  // Veriifcar si el tipo de cilindraje va en el body si es moto
  if (tipo === 'moto' && !cilindraje) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Ingrese el cilindraje de la moto'
    });
    return;
  }

  // ! Verificar el tipo de cilindraje permitidos o reales (50cc, 100, 150cc 250cc etc...)

  try {
    // Validar que el vehiculo NO haya sido registrado anteriormente
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS);
    const query = instance.where('placa', '==', placa);
    const carSnap = await query.get();

    // Si tiene registros el array es porque ya esta registrado
    if (carSnap.docs.length) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'El vehiculo ya ha sido registrado',
      });
      return;
    }

    const query2 = instance.where('uid', '==', req.user.uid);
    const carsSnap = await query2.get();


    if (carsSnap.docs.length > 2) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Has llegado al límite de vehículos a registrar',
      });
      return;
    }

    // Creamos el vehiculo en firebase
    const vehiculoAgregado = await instance.add({
      marca,
      modelo,
      year,
      placa,
      kilometraje,
      tipo: tipoVehiculo,
      cilindraje,
      uid: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agregamos al documento recien creado el id como campo adicional (util para consultas en un futuro por ID).
    await instance.doc(vehiculoAgregado.id).update({
      id: vehiculoAgregado.id,
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Vehículo creado exitosamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al guardar el vehículo: ' + error,
    });
  }

}


export async function getVehiculos(req: Request, res: Response) {
  const { id } = req.query;

  try {
    let query;
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS);

    if (id) {
      query = instance.where('id', '==', id).where('uid', '==', req.user.uid);
    } else {
      query = instance.where('uid', '==', req.user.uid);
    }

    const carSnap = await query.get();

    if (carSnap.docs.length === 0) {
      res.status(404).json({
        error: true,
        code: 404,
        message: id ? 'No se encontro un vehículo registrado con el id proporcionado' : 'Aún no tienes un vehículo registrado. Crea uno',
      });
      return;
    }

    const vehiculosUser = carSnap.docs.map(car => {
      return {
        id: car.id,
        ...car.data(),
      };
    });

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: carSnap.docs.length,
      message: 'Vehiculos obtenidos correctamente',
      data: vehiculosUser,
    });

  } catch (error) {
    console.log(error);
  }

}

export async function updateVehiculo(req: Request, res: Response) {
  // id del vehiculo a editar
  const { id } = req.params;

  // Campos de body para crear un vehiculo
  const { tipo, marca, modelo, year, placa, kilometraje, cilindraje } = req.body;

  if (id.toString().length < 5) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Envie un id válido',
    });
    return;
  }

  // Validar que todos los campos requeridos hayan sido enviados
  if (!marca || !modelo || !year || !placa || !kilometraje) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos como: marca, modelo, year, placa o kilometraje',
    });
    return;
  }

  if (tipo === 'moto' && !cilindraje) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Ingrese el cilindraje de la moto'
    });
    return;
  }

  try {
    // Validar que el vehiculo NO haya sido registrado anteriormente
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS);
    const query = instance.where('id', '==', id);
    const carSnap = await query.get();

    // Si NO tiene registros el array es porque NO esta registrado
    if (carSnap.docs.length === 0) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El vehículo no ha sido registrado. Verifique.',
      });
      return;
    }

    const vehiculo = carSnap.docs[0].data();

    if (kilometraje < Number(vehiculo.kilometraje)) {
      res.status(200).json({
        error: true,
        code: 200,
        message: 'El kilometraje ingresado es menor al kilometraje del vehículo.',
      });
      return;
    }

    if (vehiculo.uid !== req.user.uid) {
      res.status(403).json({
        error: true,
        code: 403,
        message: 'No puede editar este vehículo porque no le pertenece',
      });
      return;
    }


    await instance.doc(id).update({
      cilindraje,
      year,
      kilometraje,
      updatedAt: new Date(),
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Información actualizada correctamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al guardar el vehículo: ' + error,
    });
  }

}


export async function eliminarVehiculo(req: Request, res: Response) {
  // id del vehiculo a editar
  const { id } = req.params;

  if (id.toString().length < 5) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Envie un id válido',
    });
    return;
  }

  try {
    // Validar que el vehiculo NO haya sido registrado anteriormente
    const instanceVehiculo = firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS);
    const instanceMan = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS);
    const queryVehiculo = instanceVehiculo.where('id', '==', id);
    const queryMan = instanceMan.where('uid', '==', req.user.uid).where('vehiculo', '==', id.toString());
    const carSnap = await queryVehiculo.get();
    const manSnap = await queryMan.get();

    // Si NO tiene registros el array es porque NO esta registrado
    if (carSnap.docs.length === 0) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El vehículo no encontrado',
      });
      return;
    }

    // Si el uid del vehiculo es distinto al del usuario logueado (el que intenta hacer la petición)
    // Significa que esta intentando eliminar vehiculo de otra persona, por eso se envia ese mensaje generico
    // No se envia status 403 Forbiden para evitar actos maliciosos de intento de adivinar el ID de un vehículo.
    if (carSnap.docs[0].data().uid !== req.user.uid) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El vehículo con el id proporcionado no existe',
      });
      return;
    }

    // Eliminar vehiculo
    await instanceVehiculo.doc(id).delete();

    // Eliminar mantenimientos del vehiculo
    manSnap.docs.map(async man => {
      await instanceMan.doc(man.id).delete();
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Información actualizada correctamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al guardar el vehículo: ' + error,
    });
  }

}


export async function sumarKilometraje(req: Request, res: Response) {
  // id del vehiculo a sumar
  const { id } = req.params;

  if (!id || id.toString().length < 5) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Envie un id válido',
    });
    return;
  }

  // km recorridos y id único del viaje (generado en el telefono al iniciar el viaje)
  const { km, viajeId } = req.body;

  if (km === undefined || km === null || Number(km) <= 0) {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'Envie un kilometraje válido mayor a 0',
    });
    return;
  }

  if (!viajeId || String(viajeId).trim() === '') {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'Envie un id de viaje válido',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS);
    const query = instance.where('id', '==', id);
    const carSnap = await query.get();

    // Si NO tiene registros el array es porque NO esta registrado
    if (carSnap.docs.length === 0) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El vehículo no ha sido registrado. Verifique.',
      });
      return;
    }

    const vehiculo = carSnap.docs[0].data();

    // El vehículo solo lo puede modificar su propietario
    if (vehiculo.uid !== req.user.uid) {
      res.status(403).json({
        error: true,
        code: 403,
        message: 'No tienes permiso para modificar este vehículo',
      });
      return;
    }

    // Evitar idempotencia: si este viaje ya se sumó, responder éxito sin duplicar.
    if (vehiculo.ultimoViajeId === String(viajeId)) {
      res.status(200).json({
        error: false,
        code: 200,
        message: 'Viaje ya registrado',
        data: { kilometraje: vehiculo.kilometraje },
      });
      return;
    }

    const nuevoKilometraje = Math.round((Number(vehiculo.kilometraje) + Number(km)) * 10) / 10;

    await instance.doc(id).update({
      kilometraje: nuevoKilometraje,
      ultimoViajeId: String(viajeId),
      updatedAt: new Date(),
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Kilometraje sumado correctamente',
      data: { kilometraje: nuevoKilometraje },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al sumar el kilometraje: ' + error,
    });
  }

}
