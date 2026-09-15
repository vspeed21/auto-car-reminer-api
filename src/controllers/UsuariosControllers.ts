import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';



export async function updateUserConfig(req: Request, res: Response) {
  const { unidad, convertir } = req.body ?? {};
  const unidadesPermitidas = ['kilometros', 'millas'];

  if (!unidad || !unidadesPermitidas.includes(String(unidad).toLowerCase())) {
    res.status(400).json({
      error: true,
      code: 400,
      message: 'Debe enviar una unidad válida: kilometros o millas',
    });
    return;
  }

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS);
    const query = instance.where('uid', '==', req.user.uid);
    const usuario = await query.get();

    if (usuario.docs.length === 0) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El uid en el token no es valido',
      });
      return;
    }

    const nuevaUnidad = String(unidad).toLowerCase();
    const unidadAnterior = String(usuario.docs[0].data().config?.unidad ?? 'kilometros').toLowerCase();
    const debeConvertir = convertir !== false && unidadAnterior !== nuevaUnidad;

    let vehiculosConvertidos = 0;
    let mantenimientosConvertidos = 0;
    let combustibleConvertido = 0;

    if (debeConvertir) {
      // Los valores guardados están en la unidad anterior: se convierten a la nueva.
      // km -> mi: / 1.609344 | mi -> km: * 1.609344
      const factor = nuevaUnidad === 'millas' ? 1 / 1.609344 : 1.609344;
      const convertirValor = (valor: any) =>
        Number.isFinite(Number(valor)) ? Math.round(Number(valor) * factor) : null;

      const [vehiculosSnap, mantesSnap, combustibleSnap] = await Promise.all([
        firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).where('uid', '==', req.user.uid).get(),
        firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS).where('uid', '==', req.user.uid).get(),
        firebase.db.collection(FIREBASE_COLLECTION_NAMES.COMBUSTIBLE).where('uid', '==', req.user.uid).get(),
      ]);

      const batch = firebase.db.batch();

      vehiculosSnap.docs.forEach(doc => {
        const nuevo = convertirValor(doc.data().kilometraje);
        if (nuevo !== null) {
          batch.update(doc.ref, { kilometraje: nuevo, updatedAt: new Date() });
          vehiculosConvertidos++;
        }
      });

      mantesSnap.docs.forEach(doc => {
        const cambios: Record<string, number | Date> = { updatedAt: new Date() };
        let toco = false;
        (['kilometraje_actual', 'km_recordatorio'] as const).forEach(campo => {
          const nuevo = convertirValor(doc.data()[campo]);
          if (nuevo !== null) {
            cambios[campo] = nuevo;
            toco = true;
          }
        });
        if (toco) {
          batch.update(doc.ref, cambios);
          mantenimientosConvertidos++;
        }
      });

      combustibleSnap.docs.forEach(doc => {
        const nuevo = convertirValor(doc.data().km);
        if (nuevo !== null) {
          batch.update(doc.ref, { km: nuevo, updatedAt: new Date() });
          combustibleConvertido++;
        }
      });

      await batch.commit();
    }

    await instance.doc(usuario.docs[0].id).update({
      config: {
        unidad: nuevaUnidad,
      },
      updatedAt: new Date(),
    });

    res.status(200).json({
      error: false,
      code: 200,
      message: debeConvertir
        ? `Unidad actualizada y valores convertidos a ${nuevaUnidad}`
        : 'Configuración actualizada exitosamente',
      data: {
        unidad: nuevaUnidad,
        conversionAplicada: debeConvertir,
        vehiculosConvertidos,
        mantenimientosConvertidos,
        combustibleConvertido,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al actualizar la configuración: ' + error,
    });
  }

}

export async function getUserStats(req: Request, res: Response) {
  try {
    const uid = req.user.uid;

    const [vehiculosSnap, mantesSnap] = await Promise.all([
      firebase.db.collection(FIREBASE_COLLECTION_NAMES.VEHICULOS).where('uid', '==', uid).get(),
      firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS).where('uid', '==', uid).get(),
    ]);

    const vehiculos = vehiculosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const mantenimientos = mantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const porVehiculo = vehiculos.map((v: any) => {
      const delVehiculo = mantenimientos.filter((m: any) => m.vehiculo === v.id);
      const gasto = delVehiculo.reduce(
        (acc: number, m: any) => acc + (Number(m.costo_manoobra) || 0) + (Number(m.costo_repuestos) || 0),
        0
      );
      const proximas = delVehiculo
        .map((m: any) => fechaToDate(m.fecha_recordatorio))
        .filter((f: Date | null): f is Date => f !== null)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      return {
        vehicleId: v.id,
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        mantenimientos: delVehiculo.length,
        gasto,
        proximoRecordatorio: proximas.length ? proximas[0].toISOString() : null,
      };
    });

    const gastoTotal = porVehiculo.reduce((acc: number, v) => acc + v.gasto, 0);

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Estadísticas del usuario obtenidas correctamente',
      data: {
        vehiculos: vehiculosSnap.size,
        mantenimientos: mantesSnap.size,
        gastoTotal,
        porVehiculo,
      },
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al obtener las estadísticas: ' + error,
    });
  }

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

export async function updateTokenUser(req: Request, res: Response) {
  const { token } = req.body;

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS);
    const query = instance.where('uid', '==', req.user.uid);
    const usuario = await query.get();

    if (usuario.docs.length === 0) {
      res.status(404).json({
        error: true,
        code: 404,
        message: 'El uid en el token no es valido',
      });
      return;
    }

    await instance.doc(usuario.docs[0].id).update({
      token,
      updatedAt: new Date(),
    });

    res.status(201).json({
      error: false,
      code: 201,
      message: 'Token actualizado exitosamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al actualizar el usuario: ' + error,
    });
  }

}

export async function enviarNotificacionTest(req: Request, res: Response) {

  try {
    // 1. Obtener la fecha de hoy
    const today = new Date().toISOString().split('T')[0];

    // 2. Buscar mantenimientos de hoy
    const mantenimientosSnapshot = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.MANTENIMIENTOS)
      .where('fecha', '==', today)
      .get();

    if (mantenimientosSnapshot.empty) {
      res.json({ message: 'No hay mantenimientos' });
      return;
    }

    // 3. Procesar y enviar
    const promesasNotificaciones = mantenimientosSnapshot.docs.map(async (doc) => {
      const mantenimiento = doc.data();

      const userDoc = await firebase.db.collection('usuarios').doc(mantenimiento.uid).get();
      const userToken = userDoc.data()?.token;

      const notificacionEnviada = await firebase.messaging.send({
        notification: {
          title: '¡Recordatorio de Mantenimiento!',
          body: `Tu vehículo necesita: ${mantenimiento.nombre} antes del ${mantenimiento.fecha_recordatorio}.`,
        },
        token: userToken,
      });
      // await doc.ref.update({ notificacionEnviada: true });
      res.json({ notificacionEnviada });
    });

    await Promise.all(promesasNotificaciones);
    // console.log(`Se enviaron ${mantenimientosSnapshot.size} notificaciones.`);

  } catch (error) {
    console.error('Error en la función de recordatorios:', error);
  }

}


export async function getCurrentUserInfo(req: Request, res: Response) {

  try {
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS);
    const query = await instance.where('uid', '==', req.user.uid).get();

    if (query.size === 0) {
      res.json({
        error: true,
        code: 404,
        message: 'Usuario no encontrado',
      });
      return;
    }

    res.status(200).json({
      nombre: query.docs[0].data().nombre,
      email: query.docs[0].data().email,
      config: query.docs[0].data().config,
    });

  } catch (error) {
    console.log(error);
  }
}
