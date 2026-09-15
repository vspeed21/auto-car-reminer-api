import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Inicializa la app
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fechaToDate(fecha: unknown): Date | null {
  try {
    if (!fecha) return null;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
      const d = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    const ts = fecha as { _seconds?: number; toDate?: () => Date };
    if (typeof ts._seconds === 'number') {
      return new Date(ts._seconds * 1000);
    }
    if (typeof ts.toDate === 'function') {
      return ts.toDate();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Martes y jueves 10:00 AM avisa mantenimientos vencidos
 * y por vencer en 7 días o menos. Se reenvía en cada ejecución mientras
 * sigan en ese estado
 */
export const recordarMantenimientosSemanales = onSchedule(
  {
    schedule: '0 10 * * 2,4',
    timeZone: 'America/Tegucigalpa',
  },
  async () => {
    try {
      const ahoraTeg = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }));
      const hoy = inicioDelDia(ahoraTeg);
      const limite = new Date(hoy);
      limite.setDate(limite.getDate() + 7);

      // Rango en un solo campo
      const snapshot = await db.collection('mantenimientos')
        .where('fecha_recordatorio', '<=', limite)
        .get();

      if (snapshot.empty) {
        console.log('Sin mantenimientos próximos o vencidos.');
        return;
      }

      // Vehículos involucrados (una lectura por ID único).
      const vehiculoIds = [...new Set(
        snapshot.docs.map(doc => doc.data().vehiculo).filter(Boolean)
      )];
      const vehiculosPorId: Record<string, { placa?: string; marca?: string; modelo?: string }> = {};
      await Promise.all(vehiculoIds.map(async (id: string) => {
        const v = await db.collection('vehiculos').doc(id).get();
        if (v.exists) vehiculosPorId[id] = v.data() as { placa?: string; marca?: string; modelo?: string };
      }));

      let enviadas = 0;
      const envios = snapshot.docs.map(async (doc) => {
        const m = doc.data();
        const fecha = fechaToDate(m.fecha_recordatorio);
        if (!fecha) return;

        const dias = Math.round((inicioDelDia(fecha).getTime() - hoy.getTime()) / 86400000);
        // Solo vencidos o por vencer en 7 días o menos.
        if (dias > 7) return;
        if (!m.uid) return;

        const userDoc = await db.collection('usuarios').doc(m.uid).get();
        // El token push se guarda en `token` (PATCH /usuarios/token); respaldo a `fcmToken`.
        const pushToken = userDoc.data()?.token || userDoc.data()?.fcmToken;
        if (!pushToken) return;

        const v = m.vehiculo ? vehiculosPorId[m.vehiculo] : undefined;
        const vehiculoTxt = v?.placa ? ` (${v.placa})` : '';
        const cuerpo = dias < 0
          ? `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}: ${m.nombre}${vehiculoTxt}.`
          : dias === 0
            ? `Vence hoy: ${m.nombre}${vehiculoTxt}.`
            : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}: ${m.nombre}${vehiculoTxt}.`;

        await admin.messaging().send({
          token: pushToken,
          notification: {
            title: '¡Recordatorio de Mantenimiento!',
            body: cuerpo,
          },
          data: { mantenimientoId: doc.id },
        });
        enviadas++;
      });

      await Promise.all(envios);
      console.log(`Recordatorios semanales enviados: ${enviadas} de ${snapshot.size} candidatos.`);

    } catch (error) {
      console.error('Error en recordarMantenimientosSemanales:', error);
    }
  }
);

export const enviarRecordatoriosMantenimiento = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'America/Tegucigalpa'
  },
  async () => {
    try {
      // 1. Obtener la fecha de hoy
      const today = new Date().toISOString().split('T')[0];

      // 2. Buscar mantenimientos de hoy
      const mantenimientosSnapshot = await db.collection('mantenimientos')
        .where('fecha_recordatorio', '==', today)
        .get();

      if (mantenimientosSnapshot.empty) {
        console.log('No hay recordatorios para hoy.');
        return;
      }

      // 3. Procesar y enviar
      const promesasNotificaciones = mantenimientosSnapshot.docs.map(async (doc) => {
        const mantenimiento = doc.data();

        const userDoc = await db.collection('usuarios').doc(mantenimiento.uid).get();
        const fcmToken = userDoc.data()?.fcmToken;

        if (!fcmToken) return;

        const message = {
          token: fcmToken,
          notification: {
            title: '¡Recordatorio de Mantenimiento!',
            body: `Tu vehículo necesita: ${mantenimiento.nombre} antes del ${mantenimiento.fecha_recordatorio}.`,
          },
          data: { mantenimientoId: doc.id }
        };

        await admin.messaging().send(message);
        await doc.ref.update({ notificacionEnviada: true });
      });

      await Promise.all(promesasNotificaciones);
      console.log(`Se enviaron ${mantenimientosSnapshot.size} notificaciones.`);

    } catch (error) {
      console.error('Error en la función de recordatorios:', error);
    }
  }
);

export async function obtenerMantenimientosProximos() {
  const hoy = new Date();

  // Calcular el mes objetivo (3 meses después)
  const mesObjetivo = hoy.getMonth() + 3;
  const anioObjetivo = hoy.getFullYear();

  const fechaInicio = new Date(anioObjetivo, mesObjetivo, 1);

  const fechaFin = new Date(anioObjetivo, mesObjetivo + 1, 0, 23, 59, 59);

  const mantenimientosRef = db.collection('mantenimientos');
  const query = mantenimientosRef.
    where('fecha_recordatorio', '>=', fechaInicio).
    where('fecha_recordatorio', '<=', fechaFin);

  const querySnapshot = await query.get();
  return querySnapshot.docs.map(doc => doc.data());
}
