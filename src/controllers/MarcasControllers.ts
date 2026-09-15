/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

export async function getMarcas(req: Request, res: Response) {
  try {
    const snapshot = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS).get();

    const marcas = snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data(),
      };
    });

    // Orden alfabético local para no exigir índices.
    marcas.sort((a: any, b: any) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: snapshot.size,
      message: 'Marcas obtenidas correctamente',
      data: marcas,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener las marcas: ' + error,
    });
  }
}

export async function getMarcaById(req: Request, res: Response) {
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
    const doc = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS).doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró una marca con el id proporcionado',
      });
      return;
    }

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Marca obtenida correctamente',
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
      message: 'Ocurrio un error al obtener la marca: ' + error,
    });
  }
}

export async function crearMarca(req: Request, res: Response) {
  const { nombre } = req.body ?? {};

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'El campo nombre es obligatorio',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS);
    const data = { nombre: nombre.trim() };

    const duplicado = await instance.where('nombre', '==', data.nombre).limit(1).get();
    if (!duplicado.empty) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe una marca con ese nombre',
      });
      return;
    }

    const agregada = await instance.add(data);

    res.status(201).json({
      error: false,
      code: 201,
      message: 'Marca creada exitosamente',
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
      message: 'Ocurrio un error al crear la marca: ' + error,
    });
  }
}

export async function actualizarMarca(req: Request, res: Response) {
  const { id } = req.params;
  const { nombre } = req.body ?? {};

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'El campo nombre es obligatorio',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS);
    const data = { nombre: nombre.trim() };

    const doc = await instance.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró una marca con el id proporcionado',
      });
      return;
    }

    const duplicado = await instance.where('nombre', '==', data.nombre).limit(1).get();
    if (!duplicado.empty && duplicado.docs[0].id !== id) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe otra marca con ese nombre',
      });
      return;
    }

    await instance.doc(id).update(data);

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Marca actualizada correctamente',
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
      message: 'Ocurrio un error al actualizar la marca: ' + error,
    });
  }
}
