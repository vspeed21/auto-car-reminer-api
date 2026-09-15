/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fechaToDate(fecha: any): Date | null {
  try {
    if (!fecha) return null;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
      const d = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof fecha._seconds === 'number') {
      const d = new Date(fecha._seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    return null;
  } catch {
    return null;
  }
}

export async function getRecordatorios(req: Request, res: Response) {
  const diasParam = req.query.dias;
  let dias = 30;

  if (diasParam !== undefined) {
    dias = Number(diasParam);
    if (!Number.isFinite(dias) || dias < 0) {
      res.status(400).json({
        error: true,
        code: 400,
        message: 'El parámetro dias debe ser un número mayor o igual a 0',
      });
      return;
    }
    dias = Math.floor(dias);
  }

  try {
    const uid = req.user.uid;

    const [mantesSnap, vehiculosSnap] = await Promise.all([
      firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS).where('uid', '==', uid).get(),
      firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).where('uid', '==', uid).get(),
    ]);

    const vehiculosPorId: Record<string, any> = {};
    vehiculosSnap.docs.forEach(doc => {
      vehiculosPorId[doc.id] = { id: doc.id, ...doc.data() };
    });

    const hoy = inicioDelDia(new Date());
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + dias);

    const vencidos: any[] = [];
    const proximos: any[] = [];

    mantesSnap.docs.forEach(doc => {
      const m = doc.data();
      const fecha = fechaToDate(m.fecha_recordatorio);
      if (!fecha) return;

      const f = inicioDelDia(fecha);
      if (f > limite) return;

      const v = vehiculosPorId[m.vehiculo];
      const diasRestantes = Math.round((f.getTime() - hoy.getTime()) / 86400000);

      const item = {
        mantenimientoId: doc.id,
        nombre: m.nombre,
        tipo: m.tipo,
        fecha_recordatorio: f.toISOString(),
        km_recordatorio: m.km_recordatorio,
        diasRestantes,
        estado: diasRestantes < 0 ? 'vencido' : diasRestantes === 0 ? 'hoy' : 'proximo',
        vehiculo: v ? { id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo } : null,
      };

      if (diasRestantes < 0) {
        vencidos.push(item);
      } else {
        proximos.push(item);
      }
    });

    vencidos.sort((a, b) => a.fecha_recordatorio.localeCompare(b.fecha_recordatorio));
    proximos.sort((a, b) => a.fecha_recordatorio.localeCompare(b.fecha_recordatorio));

    const data = [...vencidos, ...proximos];

    res.status(200).json({
      error: false,
      code: 200,
      cantidad: data.length,
      message: 'Recordatorios del usuario obtenidos correctamente',
      data,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener los recordatorios: ' + error,
    });
  }
}
