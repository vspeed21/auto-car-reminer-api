/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';
import { tipoModelo } from './ModelosControllers';

function leerJson(nombreArchivo: string): any[] | null {
  const candidatos = [
    path.join(process.cwd(), 'src', 'data', nombreArchivo),
    path.join(__dirname, 'data', nombreArchivo),
    path.join(__dirname, '..', 'src', 'data', nombreArchivo),
  ];
  const ruta = candidatos.find((c) => fs.existsSync(c));
  if (!ruta) return null;

  const contenido = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  return Array.isArray(contenido) ? contenido : null;
}

export async function crearMantenimientoCatalogo(req: Request, res: Response) {
  const errorValidacion = validarItemCatalogo(req.body);

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
    const data = normalizarItemCatalogo(req.body);

    // Duplicado = mismo nombre para el mismo tipo de vehículo.
    const candidatos = await instance.where('nombre', '==', data.nombre).get();
    if (candidatos.docs.some(doc => (doc.data().aplicaA || 'automovil') === data.aplicaA)) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe un mantenimiento en el catálogo con ese nombre para ese tipo de vehículo',
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

export async function getMantenimientosCatalogo(req: Request, res: Response) {
  try {
    const snapshot = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA).get();

    const { aplicaA } = req.query;
    const filtro = typeof aplicaA === 'string' && ['automovil', 'moto'].includes(aplicaA.toLowerCase())
      ? aplicaA.toLowerCase()
      : null;

    const lista = snapshot.docs
      .map(doc => {
        return {
          id: doc.id,
          ...doc.data(),
        };
      }).filter((item: any) => !filtro || (item.aplicaA || 'automovil') === filtro);

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

export async function getMantenimientoCatalogoById(req: Request, res: Response) {
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

export async function actualizarMantenimientoCatalogo(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Debe enviar un id válido',
    });
    return;
  }

  const errorValidacion = validarItemCatalogo(req.body);

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
    const data = normalizarItemCatalogo(req.body);

    const doc = await instance.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró un mantenimiento en el catálogo con el id proporcionado',
      });
      return;
    }

    const candidatos = await instance.where('nombre', '==', data.nombre).get();
    if (candidatos.docs.some(doc => doc.id !== id && (doc.data().aplicaA || 'automovil') === data.aplicaA)) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'Ya existe otro mantenimiento en el catálogo con ese nombre para ese tipo de vehículo',
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

export async function eliminarMantenimientoCatalogo(req: Request, res: Response) {
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
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS_LISTA);

    const doc = await instance.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'No se encontró un mantenimiento en el catálogo con el id proporcionado',
      });
      return;
    }

    await instance.doc(id).delete();

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Mantenimiento del catálogo eliminado correctamenteo',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al eliminar el mantenimiento del catálogo: ' + error,
    });
  }
}

/**
 * Siembra el catálogo de vehículos: primero las marcas y luego los modelos
 * enlazados por nombre de marca. Es idempotente (upsert): no duplica y
 * actualiza los existentes. Sin autenticación para ejecutarlo directo
 * desde el navegador (igual que los demás seeds).
 */
export async function seedCatalogo(req: Request, res: Response) {
  try {
    const marcas = leerJson('marcas.json');
    const modelos = leerJson('modelos.json');

    if (!marcas || !modelos) {
      res.status(500).json({
        error: true,
        code: 500,
        message: 'No se encontraron los archivos marcas.json y/o modelos.json en el servidor',
      });
      return;
    }

    const marcasRef = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MARCAS);
    const modelosRef = firebase.db.collection(FIREBASE_COLLECTION_NAMES.MODELOS);

    const marcaIds: Record<string, string> = {};
    let marcasCreadas = 0;
    let marcasExistentes = 0;

    for (const item of marcas) {
      if (!item || !item.nombre) continue;
      const nombre = String(item.nombre).trim();

      const existente = await marcasRef.where('nombre', '==', nombre).limit(1).get();
      if (existente.empty) {
        const agregada = await marcasRef.add({ nombre });
        marcaIds[nombre] = agregada.id;
        marcasCreadas++;
      } else {
        marcaIds[nombre] = existente.docs[0].id;
        marcasExistentes++;
      }
    }

    let modelosCreados = 0;
    let modelosActualizados = 0;
    const modelosOmitidos: string[] = [];

    for (const item of modelos) {
      if (!item || !item.nombre) continue;
      const nombre = String(item.nombre).trim();
      const marcaId = marcaIds[String(item.marca || '').trim()];

      if (!marcaId) {
        modelosOmitidos.push(`${nombre} (marca ${(item.marca || '').toString().trim() || 'sin marca'})`);
        continue;
      }

      const data: any = { nombre, marcaId, tipo: tipoModelo(item) };
      if (item.year !== undefined && item.year !== null && item.year !== '') {
        data.year = Number(item.year);
      }

      const existente = await modelosRef.where('nombre', '==', nombre).get();
      const mismo = existente.docs.find(doc => doc.data().marcaId === marcaId);

      if (!mismo) {
        await modelosRef.add(data);
        modelosCreados++;
      } else {
        await modelosRef.doc(mismo.id).update(data);
        modelosActualizados++;
      }
    }

    res.status(200).json({
      error: false,
      code: 200,
      message: `Catálogo sincronizado: ${marcasCreadas} marcas creadas, ${modelosCreados} modelos creados, ${modelosActualizados} actualizados`,
      data: {
        marcas: { total: marcas.length, creadas: marcasCreadas, existentes: marcasExistentes },
        modelos: { total: modelos.length, creados: modelosCreados, actualizados: modelosActualizados, omitidos: modelosOmitidos },
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al sembrar el catálogo de vehículos: ' + error,
    });
  }
}

function validarItemCatalogo(item: any): string | null {
  if (!item || typeof item.nombre !== 'string' || !item.nombre.trim()) {
    return 'El campo nombre es obligatorio';
  }
  if (item.aplicaA !== undefined && item.aplicaA !== null && item.aplicaA !== ''
    && !['automovil', 'moto'].includes(String(item.aplicaA).toLowerCase())) {
    return 'El campo aplicaA debe ser automovil o moto';
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

function normalizarItemCatalogo(item: any) {
  const aplicaA = String(item.aplicaA || 'automovil').toLowerCase();
  return {
    nombre: String(item.nombre).trim(),
    intervaloFechaDias: Number(item.intervaloFechaDias),
    intervaloKm: Number(item.intervaloKm),
    intervaloMilla: Number(item.intervaloMilla),
    aplicaA: aplicaA === 'moto' ? 'moto' : 'automovil',
  };
}
