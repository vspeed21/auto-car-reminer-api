/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

export async function crearMantenimiento(req: Request, res: Response) {

  try {
    const instance = firebase.db.collection('mantenimientosVehiculo');

    const data: any[] = [];

    for (const item of data) {
      await instance.add(item);
      console.log(`Añadido: ${item.nombre}`);
    }
    console.log('¡Carga completada!');

    const mantenimientoAgregado = await instance.add({
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agregamos al documento recien creado el id como campo adicional (util para consultas en un futuro por ID).
    await instance.doc(mantenimientoAgregado.id).update({
      id: mantenimientoAgregado.id,
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Mantenimientos creado correctamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al guardar el mantenimiento: ' + error,
    });
  }

}

export async function crearMantenimientoVehiculo(req: Request, res: Response) {
  // Campos de body para crear un vehiculo
  const { actualizar_kilometraje, tipo, nombre, fecha, kilometraje_actual, fecha_recordatorio, km_recordatorio, tipo_repuestos, costo_repuestos, costo_manoobra, comprado, manoobra, vehiculo } = req.body;

  // Validar que todos los campos requeridos hayan sido enviados
  if (!tipo || !nombre || !fecha || !kilometraje_actual || !fecha_recordatorio) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS);
    const carInstance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS);

    // El KM del vehículo solo sube: si el registrado es menor o igual al actual,
    // se conserva el actual. El mantenimiento siempre se guarda con su KM.
    let kilometrajeActualizado = false;
    if (actualizar_kilometraje && vehiculo) {
      const vehiculoDoc = await carInstance.doc(vehiculo).get();
      const kmActualVehiculo = Number(vehiculoDoc.data()?.kilometraje);
      if (!vehiculoDoc.exists || !Number.isFinite(kmActualVehiculo) || Number(kilometraje_actual) > kmActualVehiculo) {
        await carInstance.doc(vehiculo).update({
          kilometraje: kilometraje_actual,
        });
        kilometrajeActualizado = true;
      }
    }

    // Creamos el mantenimiento en firebase
    const mantenimientoAgregado = await instance.add({
      tipo, nombre, kilometraje_actual,
      km_recordatorio, tipo_repuestos, costo_repuestos, costo_manoobra, comprado, manoobra,
      vehiculo,
      fecha: new Date(fecha),
      fecha_recordatorio: new Date(fecha_recordatorio),
      uid: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agregamos al documento recien creado el id como campo adicional (util para consultas en un futuro por ID).
    await instance.doc(mantenimientoAgregado.id).update({
      id: mantenimientoAgregado.id,
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: `Mantenimiento agregado exitosamente al vehiculo ${vehiculo}`,
      data: {
        id: mantenimientoAgregado.id,
        kilometrajeActualizado,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al guardar el mantenimiento: ' + error,
    });
  }

}


/**
 * Inserta (o actualiza) en la colección `mantenimientos_lista` el catálogo
 * del archivo src/data/mantenimientos-lista.json. Es idempotente: si se
 * ejecuta varias veces no duplica, solo crea los faltantes y actualiza
 * intervalos de los existentes. No requiere autenticación para poder
 * ejecutarse directo desde el navegador (igual que /test y /noti).
 */
export async function seedMantenimientosLista(req: Request, res: Response) {
  try {
    const candidatos = [
      path.join(process.cwd(), 'src', 'data', 'mantenimientos-lista.json'),
      path.join(__dirname, 'data', 'mantenimientos-lista.json'),
      path.join(__dirname, '..', 'src', 'data', 'mantenimientos-lista.json'),
    ];
    const ruta = candidatos.find((c) => fs.existsSync(c));

    if (!ruta) {
      res.status(500).json({
        error: true,
        code: 500,
        message: 'No se encontró el archivo mantenimientos-lista.json en el servidor',
      });
      return;
    }

    const lista = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    if (!Array.isArray(lista)) {
      res.status(500).json({
        error: true,
        code: 500,
        message: 'El archivo mantenimientos-lista.json no contiene un arreglo válido',
      });
      return;
    }

    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA);
    let creados = 0;
    let actualizados = 0;

    for (const item of lista) {
      if (!item || !item.nombre) continue;

      const existente = await instance.where('nombre', '==', item.nombre).limit(1).get();

      if (existente.empty) {
        await instance.add({
          nombre: item.nombre,
          intervaloFechaDias: item.intervaloFechaDias,
          intervaloKm: item.intervaloKm,
          intervaloMilla: item.intervaloMilla,
        });
        creados++;
      } else {
        await instance.doc(existente.docs[0].id).update({
          intervaloFechaDias: item.intervaloFechaDias,
          intervaloKm: item.intervaloKm,
          intervaloMilla: item.intervaloMilla,
        });
        actualizados++;
      }
    }

    res.status(200).json({
      error: false,
      code: 200,
      message: `Catálogo sincronizado: ${creados} creados, ${actualizados} actualizados`,
      data: {
        total: lista.length,
        creados,
        actualizados,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al sembrar el catálogo: ' + error,
    });
  }

}

function validarItemLista(item: any): string | null {
  if (!item || typeof item.nombre !== 'string' || !item.nombre.trim()) {
    return 'El campo nombre es obligatorio';
  }
  const numericos = ['intervaloFechaDias', 'intervaloKm', 'intervaloMilla'] as const;
  for (const campo of numericos) {
    if (item[campo] === undefined || item[campo] === null || item[campo] === '') {
      return `El campo ${campo} es obligatorio`;
    }
    if (!Number.isFinite(Number(item[campo])) || Number(item[campo]) < 0) {
      return `El campo ${campo} debe ser un número mayor o igual a 0`;
    }
  }
  return null;
}

function normalizarItemLista(item: any) {
  return {
    nombre: String(item.nombre).trim(),
    intervaloFechaDias: Number(item.intervaloFechaDias),
    intervaloKm: Number(item.intervaloKm),
    intervaloMilla: Number(item.intervaloMilla),
  };
}

export async function getMantenimientosLista(req: Request, res: Response) {
  try {
    const snapshot = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA).get();

    const lista = snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data(),
      };
    });

    // Orden alfabético local para no exigir índices.
    lista.sort((a: any, b: any) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: snapshot.size,
      message: 'Catálogo de mantenimientos obtenido correctamente',
      data: lista,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener el catálogo: ' + error,
    });
  }
}

export async function getMantenimientoListaById(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  try {
    const doc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA).doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró un mantenimiento en el catálogo con el id proporcionado',
      });
      return;
    }

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Mantenimiento del catálogo obtenido correctamente',
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener el mantenimiento del catálogo: ' + error,
    });
  }
}

export async function crearMantenimientoLista(req: Request, res: Response) {
  const errorValidacion = validarItemLista(req.body);

  if (errorValidacion) {
    res.status(400).json({
      error: true,
      code: 400,
      message: errorValidacion,
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA);
    const data = normalizarItemLista(req.body);

    const duplicado = await instance.where('nombre', '==', data.nombre).limit(1).get();
    if (!duplicado.empty) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe un mantenimiento en el catálogo con ese nombre',
      });
      return;
    }

    const agregado = await instance.add(data);

    res.status(201).json({
      error: false,
      code: 201,
      message: 'Mantenimiento agregado al catálogo exitosamente',
      data: {
        id: agregado.id,
        ...data,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al crear el mantenimiento del catálogo: ' + error,
    });
  }
}

export async function actualizarMantenimientoLista(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  const errorValidacion = validarItemLista(req.body);

  if (errorValidacion) {
    res.status(400).json({
      error: true,
      code: 400,
      message: errorValidacion,
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA);
    const data = normalizarItemLista(req.body);

    const doc = await instance.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró un mantenimiento en el catálogo con el id proporcionado',
      });
      return;
    }

    const duplicado = await instance.where('nombre', '==', data.nombre).limit(1).get();
    if (!duplicado.empty && duplicado.docs[0].id !== id) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe otro mantenimiento en el catálogo con ese nombre',
      });
      return;
    }

    await instance.doc(id).update(data);

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Mantenimiento del catálogo actualizado correctamente',
      data: {
        id,
        ...data,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al actualizar el mantenimiento del catálogo: ' + error,
    });
  }
}

export async function actualizarMantenimiento(req: Request, res: Response) {
  // id del mantenimiento a editar
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  // Campos de body para editar un mantenimiento (mismos requeridos que al crear)
  const { tipo, nombre, fecha, kilometraje_actual, fecha_recordatorio, km_recordatorio, tipo_repuestos, costo_repuestos, costo_manoobra, comprado, manoobra, vehiculo, actualizar_kilometraje } = req.body;

  if (!tipo || !nombre || !fecha || !kilometraje_actual || !fecha_recordatorio) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS);
    const doc = await instance.doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El mantenimiento no ha sido registrado. Verifique.',
      });
      return;
    }

    // Solo el dueño puede editarlo.
    if (doc.data()?.uid !== req.user.uid) {
      res.status(403).json({
        error: true,
        code: 403,
        message: 'No tienes permiso para editar este mantenimiento',
      });
      return;
    }

    // El KM del vehículo solo sube (igual que al crear).
    let kilometrajeActualizado = false;
    if (actualizar_kilometraje && vehiculo) {
      const vehiculoDoc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).doc(vehiculo).get();
      const kmActualVehiculo = Number(vehiculoDoc.data()?.kilometraje);
      if (!vehiculoDoc.exists || !Number.isFinite(kmActualVehiculo) || Number(kilometraje_actual) > kmActualVehiculo) {
        await firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).doc(vehiculo).update({
          kilometraje: kilometraje_actual,
        });
        kilometrajeActualizado = true;
      }
    }

    await instance.doc(id).update({
      tipo, nombre, kilometraje_actual,
      km_recordatorio, tipo_repuestos, costo_repuestos, costo_manoobra, comprado, manoobra,
      fecha: new Date(fecha),
      fecha_recordatorio: new Date(fecha_recordatorio),
      updatedAt: new Date(),
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Mantenimiento actualizado correctamente',
      data: {
        id,
        kilometrajeActualizado,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al actualizar el mantenimiento: ' + error,
    });
  }

}

export async function eliminarMantenimiento(req: Request, res: Response) {
  // id del mantenimiento a eliminar
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS);
    const doc = await instance.doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El mantenimiento no ha sido registrado. Verifique.',
      });
      return;
    }

    // Solo el dueño puede eliminarlo.
    if (doc.data()?.uid !== req.user.uid) {
      res.status(403).json({
        error: true,
        code: 403,
        message: 'No tienes permiso para eliminar este mantenimiento',
      });
      return;
    }

    await instance.doc(id).delete();

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Mantenimiento eliminado correctamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al eliminar el mantenimiento: ' + error,
    });
  }

}

export async function getMisMantenimientos(req: Request, res: Response) {
  try {
    const snapshot = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS)
      .where('uid', '==', req.user.uid)
      .get();

    const mantenimientos = snapshot.docs.map(mantenimiento => {
      return {
        id: mantenimiento.id,
        ...mantenimiento.data(),
      };
    });

    // Orden local por fecha de creación (desc) para no exigir índice compuesto.
    mantenimientos.sort((a: any, b: any) => {
      const fa = a.createdAt?._seconds ?? 0;
      const fb = b.createdAt?._seconds ?? 0;
      return fb - fa;
    });

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: snapshot.size,
      message: 'Mantenimientos del usuario obtenidos correctamente',
      data: mantenimientos,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener los mantenimientos: ' + error,
    });
  }

}

export async function getMantenimientos(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe de enviar un id valido para obtener los mantenimientos del vehículo',
    });
    return;
  }

  try {
    const instance = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS)
      .where('vehiculo', '==', id)
      .orderBy('createdAt', 'desc')
      .get();

    console.log(instance.docs, id);

    if (instance.docs.length === 0) {
      res.status(204).json({
        error: true,
        code: 204,
        message: 'Este vehículo no tiene mantenimientos agregados. Añade uno',
      });
      return;
    }

    const mantenimientos = instance.docs.map(mantenimiento => {
      return {
        id: mantenimiento.id,
        ...mantenimiento.data(),
      };
    });

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: instance.docs.length,
      message: 'Mantenimientos del vehículo obtenido correctamente',
      data: mantenimientos,
    });

  } catch (error) {
    console.log(error);
  }

}

export async function updateVehiculo(req: Request, res: Response) {
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

  // Campos de body para crear un vehiculo
  const { marca, modelo, year, placa, kilometraje } = req.body;

  // Validar que todos los campos requeridos hayan sido enviados
  if (!marca || !modelo || !year || !placa || !kilometraje) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos como: marca, modelo, year, placa o kilometraje',
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

    await instance.doc(id).update({
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

    // Eliminar vehiculo
    await instance.doc(id).delete();

    // ! Eliminar mantenimientos

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

export async function obtenerMantenimientosProximos(req: Request, res: Response) {
  const hoy = new Date();

  const mesObjetivo = hoy.getMonth() + 1;
  const anioObjetivo = hoy.getFullYear();

  const fechaInicio = new Date(anioObjetivo, hoy.getMonth(), 1);

  const fechaFin = new Date(anioObjetivo, mesObjetivo, 0, 23, 59, 59);

  try {
    const mantenimientosRef = firebase.db.collection('mantenimientos');
    const query = mantenimientosRef.
      where('fecha_recordatorio', '>=', fechaInicio).
      where('fecha_recordatorio', '<=', fechaFin);

    const querySnapshot = await query.get();

    if (querySnapshot.size === 0) {
      res.status(404).json({
        msg: 'No hay mantenimientos proximos',
        fechaInicio,
        fechaFin,
      });
      return;
    }

    const mantenimientosPromises = querySnapshot.docs.map(async man => {
      const mantenimiento = man.data();

      // info del usuario
      const usuario = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS).where('uid', '==', man.data().uid).get();

      await firebase.messaging.send({
        notification: {
          title: '¡Recordatorio de Mantenimiento!',
          body: `Tu vehículo necesita: ${mantenimiento.nombre} antes del ${mantenimiento.fecha_recordatorio.toString()}.`,
        },
        token: usuario.docs[0].data().token,
      });

      await firebase.db.collection('recordatorios').add({
        uid: man.data().uid,
        title: '¡Recordatorio de Mantenimiento!',
        body: `Tu vehículo necesita: ${mantenimiento.nombre} antes del ${mantenimiento.fecha_recordatorio.toString()}.`,
        createdAt: new Date(),
      });

    });

    // Ejecutar promesa para envio de notificaciones
    await Promise.all(mantenimientosPromises);
    console.log(`Se enviaron ${querySnapshot.size} notificaciones.`);

    res.json({
      message: 'Notificación Enviada',
      mantenimientosPromises,
    });
  } catch (error) {
    console.log(error);
    res.json(error);
  }

}
