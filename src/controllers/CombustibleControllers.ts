/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

async function vehiculoDelUsuario(vehiculoId: string, uid: string) {
  if (!vehiculoId) return null;
  const doc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).doc(vehiculoId).get();
  if (!doc.exists) return null;
  if (doc.data()?.uid !== uid) return null;
  return { id: doc.id, ...doc.data() };
}

export async function crearTanqueada(req: Request, res: Response) {
  // Campos de body para registrar una tanqueada
  const { vehiculo, fecha, km, galones, costo, lleno, actualizar_kilometraje } = req.body;

  if (!vehiculo || !fecha || km === undefined || km === null || km === '' || galones === undefined || galones === null || galones === '') {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos como: vehiculo, fecha, km o galones'
    });
    return;
  }

  if (!Number.isFinite(Number(km)) || Number(km) <= 0 || !Number.isFinite(Number(galones)) || Number(galones) <= 0) {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'El km y los galones deben ser números mayores a 0'
    });
    return;
  }

  try {
    const vehiculoDoc: any = await vehiculoDelUsuario(vehiculo, req.user.uid);
    if (!vehiculoDoc) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El vehículo no ha sido registrado o no te pertenece. Verifique.',
      });
      return;
    }

    const data = {
      vehiculo,
      fecha: new Date(fecha),
      km: Number(km),
      galones: Number(galones),
      costo: costo === undefined || costo === null || costo === '' ? 0 : Number(costo),
      lleno: lleno !== false,
      uid: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (actualizar_kilometraje && Number(km) > Number(vehiculoDoc.kilometraje)) {
      await firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).doc(vehiculo).update({
        kilometraje: Number(km),
        updatedAt: new Date(),
      });
    }

    const agregada = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.COMBUSTIBLE).add(data);

    await firebase.db.collection(FIREBASE_COLLECTION_NAMES.COMBUSTIBLE).doc(agregada.id).update({
      id: agregada.id,
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Tanqueada registrada exitosamente',
      data: {
        id: agregada.id,
        ...data,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al registrar la tanqueada: ' + error,
    });
  }
}

export async function getTanqueadas(req: Request, res: Response) {
  try {
    const { vehiculoId } = req.query;
    let query: FirebaseFirestore.Query = firebase.db
      .collection(FIREBASE_COLLECTION_NAMES.COMBUSTIBLE)
      .where('uid', '==', req.user.uid);

    if (vehiculoId) {
      query = query.where('vehiculo', '==', String(vehiculoId));
    }

    const snapshot = await query.get();

    const tanqueadas = snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data(),
      };
    });

    // Orden local por fecha (desc) para no exigir índice compuesto.
    tanqueadas.sort((a: any, b: any) => {
      const fa = a.fecha?._seconds ?? 0;
      const fb = b.fecha?._seconds ?? 0;
      return fb - fa;
    });

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: snapshot.size,
      message: 'Tanqueadas obtenidas correctamente',
      data: tanqueadas,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener las tanqueadas: ' + error,
    });
  }
}

export async function eliminarTanqueada(req: Request, res: Response) {
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
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.COMBUSTIBLE);
    const doc = await instance.doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'La tanqueada no ha sido registrada. Verifique.',
      });
      return;
    }

    // Solo el dueño puede eliminarla.
    if (doc.data()?.uid !== req.user.uid) {
      res.status(403).json({
        error: true,
        code: 403,
        message: 'No tienes permiso para eliminar esta tanqueada',
      });
      return;
    }

    await instance.doc(id).delete();

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Tanqueada eliminada correctamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al eliminar la tanqueada: ' + error,
    });
  }
}
