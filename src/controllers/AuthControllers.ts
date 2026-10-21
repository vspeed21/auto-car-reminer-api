/* eslint-disable indent */
import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';
import generateJWT from '../helpers/generateJWT';
import { enviarBienvenidaConActivacion } from '../helpers/mailer';
import environment from '../environment';

export async function SignUp(req: Request, res: Response) {
  // Campos de body para crear un vehiculo
  const { nombre, email, password } = req.body;

  // Validar que todos los campos requeridos hayan sido enviados
  if (!nombre || !email || !password) {
    res.status(404).json({
      error: true,
      code: 404,
      message: 'Faltan datos requeridos como: nombre, correo electronico y contraseña',
    });
    return;
  }

  // Normalizar: Firestore compara con == sensible a mayúsculas.
  const nombreNorm = String(nombre).trim();
  const emailNorm = String(email).trim().toLowerCase();

  try {
    // Esta funcion valida que el usuario no este creado en FIREBASE AUTH y si lo esta, maneja error via el catch
    // Si no lo esta lo crea
    const usuario = await firebase.auth.createUser({
      email: emailNorm,
      displayName: nombreNorm,
      password,
      emailVerified: false,
    });

    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS);

    // Creamos el usuario en firestore
    await instance.add({
      nombre: nombreNorm,
      email: emailNorm,
      token: '',
      tipo: 'comprador',
      config: {
        unidad: 'millas'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      uid: usuario.uid
    });

    // Enviar correo de bienvenida con link de activación.
    try {
      const linkActivacion = await firebase.auth.generateEmailVerificationLink(emailNorm);
      await enviarBienvenidaConActivacion(nombreNorm, emailNorm, linkActivacion);
    } catch (error) {
      console.log('No se pudo enviar el correo de activación:', error);
    }

    res.status(201).json({
      error: false,
      code: 201,
      message: 'Usuario creado exitosamente',
      usuario: {
        nombre: usuario.displayName,
        email: usuario.email,
      },
    });

  } catch (error: any) {
    switch (error.code) {
      case 'auth/email-already-exists':
      case 'auth/email-already-in-use':
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'El correo electrónico ya está registrado por otra cuenta.'
        });

      case 'auth/invalid-email':
        return res.status(400).json({
          success: false,
          code: 'INVALID_EMAIL',
          message: 'El formato del correo electrónico no es válido.'
        });

      case 'auth/weak-password':
      case 'auth/invalid-password':
        return res.status(400).json({
          success: false,
          code: 'WEAK_PASSWORD',
          message: 'La contraseña debe tener al menos 6 caracteres.'
        });

      default:
        console.error('Error no controlado de Firebase:', error);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error inesperado en el servidor.'
        });
    }
  }

}


export async function getMe(req: Request, res: Response) {
  try {
    const usuario = await firebase.auth.getUser(req.user.uid);

    res.status(200).json({
      error: false,
      code: 200,
      message: 'Sesión válida',
      data: {
        uid: usuario.uid,
        nombre: usuario.displayName,
        email: usuario.email,
        tipo: req.user.tipo,
        config: req.user.config,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Error al validar la sesión',
    });
  }
}

async function verificarPasswordFirebase(email: string, password: string): Promise<{ localId: string } | null> {
  // Identity Toolkit REST: única forma de validar un password desde el servidor.
  const apiKey = environment.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    console.log('Falta FIREBASE_WEB_API_KEY: no se puede verificar la contraseña');
    return null;
  }
  try {
    const httpFetch = (globalThis as any).fetch;
    const resp = await httpFetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.localId ? { localId: data.localId } : null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function perfilPorUid(uid: string, emailNorm: string) {
  const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS);
  let snap = await instance.where('uid', '==', uid).limit(1).get();

  // Adopción: cuentas creadas antes de Firebase Auth (uid distinto).
  if (snap.empty && emailNorm) {
    const porEmail = await instance.where('email', '==', emailNorm).limit(1).get();
    if (!porEmail.empty) {
      await instance.doc(porEmail.docs[0].id).update({ uid, updatedAt: new Date() });
      snap = await instance.where('uid', '==', uid).limit(1).get();
    }
  }

  return snap.empty ? null : snap.docs[0].data();
}

export async function logInUser(req: Request, res: Response) {
  const { idToken, email, password } = req.body;

  // Ruta principal: token de Firebase Auth (verifica la contraseña de verdad).
  if (idToken) {
    try {
      const decoded = await firebase.auth.verifyIdToken(idToken);
      const emailNorm = String(decoded.email || '').trim().toLowerCase();
      const datos = await perfilPorUid(decoded.uid, emailNorm);

      if (!datos) {
        return res.status(404).json({
          code: 404,
          error: true,
          message: 'No existe perfil para este usuario. Contacte soporte',
        });
      }

      if (!decoded.email_verified) {
        return res.status(403).json({
          code: 403,
          error: true,
          message: 'Debes activar tu cuenta desde el enlace enviado a tu correo',
        });
      }

      return res.status(200).json({
        code: 200,
        error: false,
        message: 'Credenciales correctas. Bienvenido',
        usuario: {
          nombre: datos.nombre,
          email: datos.email,
          tipo: datos.tipo,
        },
        token: generateJWT(decoded.uid),
      });
    } catch (error) {
      console.log(error);
      return res.status(401).json({
        code: 401,
        error: true,
        message: 'Sesión de Firebase inválida o vencida. Inicie sesión de nuevo',
      });
    }
  }

  // Ruta legacy (apps sin Firebase Auth): verifica la contraseña contra
  // Firebase con Identity Toolkit REST. Sin esto no hay forma de validarla.
  // TODO v2: eliminarla cuando todos los clientes envíen idToken.
  const emailNorm = String(email || '').trim().toLowerCase();
  const passwordNorm = String(password || '');

  if (!emailNorm || !passwordNorm) {
    return res.status(404).json({
      code: 404,
      message: 'El correo y contraseña son obligatorios. Verifique'
    });
  }

  // Validar longitud de contraseña (8 caracteres como minimo)
  if (passwordNorm.length < 8) {
    return res.status(404).json({
      code: 404,
      error: true,
      message: 'La contraseña debe de tener 8 caracteres',
    });
  }

  try {
    const verificado = await verificarPasswordFirebase(emailNorm, passwordNorm);
    if (!verificado) {
      return res.status(401).json({
        code: 401,
        error: true,
        message: 'Correo o contraseña incorrectos',
      });
    }

    const datosLegacy = await perfilPorUid(verificado.localId, emailNorm);
    if (!datosLegacy) {
      return res.status(404).json({
        code: 404,
        error: true,
        message: 'No existe perfil para este usuario. Contacte soporte',
      });
    }

    const authUser = await firebase.auth.getUser(verificado.localId);
    if (!authUser.emailVerified) {
      return res.status(403).json({
        code: 403,
        error: true,
        message: 'Debes activar tu cuenta desde el enlace enviado a tu correo',
      });
    }

    res.status(200).json({
      code: 200,
      error: false,
      message: 'Credenciales correctas. Bienvenido',
      usuario: {
        nombre: datosLegacy.nombre,
        email: datosLegacy.email,
        tipo: datosLegacy.tipo,
      },
      token: generateJWT(verificado.localId),
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      code: 500,
      message: 'Error de autenticación',
      error,
    });
  }

}
