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

function hoyTegucigalpa(): Date {
  const ahoraTeg = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }));
  return inicioDelDia(ahoraTeg);
}

function textoRecordatorio(m: any, placa: string | undefined, dias: number): string {
  const vehiculoTxt = placa ? ` (${placa})` : '';
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}: ${m.nombre}${vehiculoTxt}.`;
  if (dias === 0) return `Vence hoy: ${m.nombre}${vehiculoTxt}.`;
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}: ${m.nombre}${vehiculoTxt}.`;
}

/**
 * Envía push por cada candidato dentro del rango (vencidos siempre +
 * hasta maxDias a futuro). Lógica compartida entre la diaria y la semanal:
 * compara Timestamps reales (nunca texto) y lee el token de `token`
 * con respaldo a `fcmToken`.
 */
async function enviarLoteRecordatorios(
  snapshot: FirebaseFirestore.QuerySnapshot,
  hoy: Date,
  maxDias: number,
  etiqueta: string
): Promise<void> {
  if (snapshot.empty) {
    console.log(`Sin candidatos para recordatorios ${etiqueta}.`);
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
    if (dias > maxDias) return;
    if (!m.uid) return;

    const userDoc = await db.collection('usuarios').doc(m.uid).get();
    const pushToken = userDoc.data()?.token || userDoc.data()?.fcmToken;
    if (!pushToken) return;

    const v = m.vehiculo ? vehiculosPorId[m.vehiculo] : undefined;

    await admin.messaging().send({
      token: pushToken,
      notification: {
        title: '¡Recordatorio de Mantenimiento!',
        body: textoRecordatorio(m, v?.placa, dias),
      },
      data: { mantenimientoId: doc.id },
    });
    enviadas++;
  });

  await Promise.all(envios);
  console.log(`Recordatorios ${etiqueta} enviados: ${enviadas} de ${snapshot.size} candidatos.`);
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
      const hoy = hoyTegucigalpa();
      const limite = new Date(hoy);
      limite.setDate(limite.getDate() + 7);

      // Rango en un solo campo (sin índice compuesto)
      const snapshot = await db.collection('mantenimientos')
        .where('fecha_recordatorio', '<=', limite)
        .get();

      await enviarLoteRecordatorios(snapshot, hoy, 7, 'semanales');
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
      const hoy = hoyTegucigalpa();
      const finDeHoy = new Date(hoy);
      finDeHoy.setHours(23, 59, 59, 999);

      // Rango en un solo campo con Timestamps reales (nunca texto)
      // y día calculado en hora de Tegucigalpa.
      const snapshot = await db.collection('mantenimientos')
        .where('fecha_recordatorio', '<=', finDeHoy)
        .get();

      // Vencidos + vencen hoy (maxDias = 0).
      await enviarLoteRecordatorios(snapshot, hoy, 0, 'diarios');

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
