/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

function validarModelo(body: any): string | null {
  if (!body || typeof body.nombre !== 'string' || !body.nombre.trim()) {
    return 'El campo nombre es obligatorio';
  }
  if (!body.marcaId || typeof body.marcaId !== 'string' || !body.marcaId.trim()) {
    return 'El campo marcaId es obligatorio (asigne el modelo a una marca)';
  }
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    if (!Number.isFinite(Number(body.year))) {
      return 'El campo year debe ser un número válido';
    }
  }
  return null;
}

async function existeMarca(marcaId: string): Promise<boolean> {
  const doc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS).doc(marcaId).get();
  return doc.exists;
}

async function conNombreMarca(modelos: any[]) {
  const marcaIds = [...new Set(modelos.map(m => m.marcaId).filter(Boolean))];
  const nombres: Record<string, string> = {};
  await Promise.all(marcaIds.map(async (marcaId: string) => {
    const doc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS).doc(marcaId).get();
    if (doc.exists) nombres[marcaId] = doc.data()?.nombre ?? '';
  }));
  return modelos.map(m => ({ ...m, marcaNombre: nombres[m.marcaId] ?? '' }));
}

export async function getModelos(req: Request, res: Response) {
  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MODELOS);
    const { marcaId } = req.query;

    const snapshot = marcaId
      ? await instance.where('marcaId', '==', String(marcaId)).get()
      : await instance.get();

    let modelos = snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data(),
      };
    });

    // Orden alfabético local para no exigir índices.
    modelos.sort((a: any, b: any) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

    modelos = await conNombreMarca(modelos);

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: snapshot.size,
      message: 'Modelos obtenidos correctamente',
      data: modelos,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener los modelos: ' + error,
    });
  }
}

export async function getModeloById(req: Request, res: Response) {
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
    const doc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MODELOS).doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró un modelo con el id proporcionado',
      });
      return;
    }

    const [modelo] = await conNombreMarca([{ id: doc.id, ...doc.data() }]);

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Modelo obtenido correctamente',
      data: modelo,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener el modelo: ' + error,
    });
  }
}

export async function crearModelo(req: Request, res: Response) {
  const errorValidacion = validarModelo(req.body);

  if (errorValidacion) {
    res.status(400).json({
      error: true,
      code: 400,
      message: errorValidacion,
    });
    return;
  }

  try {
    const marcaId = String(req.body.marcaId).trim();
    if (!await existeMarca(marcaId)) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'La marca asignada no existe',
      });
      return;
    }

    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MODELOS);
    const data: any = {
      nombre: String(req.body.nombre).trim(),
      marcaId,
    };
    if (req.body.year !== undefined && req.body.year !== null && req.body.year !== '') {
      data.year = Number(req.body.year);
    }

    const duplicado = await instance.where('nombre', '==', data.nombre).get();
    if (duplicado.docs.some(doc => doc.data().marcaId === marcaId)) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe ese modelo asignado a la marca',
      });
      return;
    }

    const agregado = await instance.add(data);

    res.status(201).json({
      error: false,
      code: 201,
      message: 'Modelo creado exitosamente',
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
      message: 'Ocurrio un error al crear el modelo: ' + error,
    });
  }
}

export async function actualizarModelo(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  const errorValidacion = validarModelo(req.body);

  if (errorValidacion) {
    res.status(400).json({
      error: true,
      code: 400,
      message: errorValidacion,
    });
    return;
  }

  try {
    const marcaId = String(req.body.marcaId).trim();
    if (!await existeMarca(marcaId)) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'La marca asignada no existe',
      });
      return;
    }

    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MODELOS);

    const doc = await instance.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró un modelo con el id proporcionado',
      });
      return;
    }

    const data: any = {
      nombre: String(req.body.nombre).trim(),
      marcaId,
    };
    if (req.body.year !== undefined && req.body.year !== null && req.body.year !== '') {
      data.year = Number(req.body.year);
    }

    const duplicado = await instance.where('nombre', '==', data.nombre).get();
    if (duplicado.docs.some(d => d.data().marcaId === marcaId && d.id !== id)) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe otro modelo con ese nombre asignado a la marca',
      });
      return;
    }

    await instance.doc(id).update(data);

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Modelo actualizado correctamente',
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
      message: 'Ocurrio un error al actualizar el modelo: ' + error,
    });
  }
}
