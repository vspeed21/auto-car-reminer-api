/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

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

      const data: any = { nombre, marcaId };
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
