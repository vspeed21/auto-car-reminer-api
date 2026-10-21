/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';


export async function crearMantenimientoVehiculo(req: Request, res: Response) {
  // Campos de body para crear un vehiculo
  const { actualizar_kilometraje, tipo, nombre, fecha, kilometraje_actual, fecha_recordatorio, km_recordatorio, tipo_repuestos, costo_repuestos, costo_manoobra, comprado, manoobra, vehiculo } = req.body;

  // Validar que todos los campos requeridos hayan sido enviados
  if (!tipo || !nombre || !fecha || !kilometraje_actual || !fecha_recordatorio || !vehiculo) {
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
    const vehiculoDoc = await carInstance.doc(vehiculo).get();

    // Validar que el vehiculo al que se intenta crear mantenimiento le pertenezca al usuario que hace la accion
    if (vehiculoDoc.data()?.uid !== req.user.uid) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El vehiculo no fue encontrado'
      });
      return;
    }

    // El KM del vehículo solo sube: si el registrado es menor o igual al actual,
    // se conserva el actual. El mantenimiento siempre se guarda con su KM.
    let kilometrajeActualizado = false;
    if (actualizar_kilometraje && vehiculo) {
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
    const aplicaAValidos = ['automovil', 'moto'];
    let creados = 0;
    let actualizados = 0;
    let backfill = 0;

    // Backfill: documentos existentes sin aplicaA se marcan automovil
    // con update en su lugar (se conserva el ID, nada se borra).
    const sinAlcance = await instance.get();
    for (const doc of sinAlcance.docs) {
      if (doc.data().aplicaA === undefined || doc.data().aplicaA === null || doc.data().aplicaA === '') {
        await instance.doc(doc.id).update({ aplicaA: 'automovil' });
        backfill++;
      }
    }

    for (const item of lista) {
      if (!item || !item.nombre) continue;

      const aplicaA = aplicaAValidos.includes(String(item.aplicaA || '').toLowerCase())
        ? String(item.aplicaA).toLowerCase()
        : 'automovil';

      const data = {
        nombre: String(item.nombre).trim(),
        intervaloFechaDias: Number(item.intervaloFechaDias) || 0,
        intervaloKm: Number(item.intervaloKm) || 0,
        intervaloMilla: Number(item.intervaloMilla) || 0,
        aplicaA,
      };

      // Clave de upsert: (nombre + aplicaA), para no chocar homónimos de otro tipo.
      const candidatos = await instance.where('nombre', '==', data.nombre).get();
      const mismo = candidatos.docs.find(doc => (doc.data().aplicaA || 'automovil') === aplicaA);

      if (!mismo) {
        await instance.add(data);
        creados++;
      } else {
        await instance.doc(mismo.id).update(data);
        actualizados++;
      }
    }

    res.status(200).json({
      error: false,
      code: 200,
      message: `Catálogo sincronizado: ${creados} creados, ${actualizados} actualizados, ${backfill} con alcance asignado`,
      data: {
        total: lista.length,
        creados,
        actualizados,
        backfill,
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
  const { vehiculoId } = req.params;

  try {
    const snapshot = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS)
      .where('uid', '==', req.user.uid)
      .where('vehiculo', '==', vehiculoId.toString())
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
