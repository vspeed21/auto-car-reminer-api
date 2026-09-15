import { Request, Response } from 'express';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';
import generateJWT from '../helpers/generateJWT';

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

  try {
    // Validar que el usuario NO haya sido registrado anteriormente
    const instance = firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS);
    const query = instance.where('email', '==', email);
    const carSnap = await query.get();

    // Si tiene registros el array es porque ya esta registrado
    if (carSnap.docs.length) {
      res.status(409).json({
        error: true,
        code: 409,
        message: 'El usuario ya ha sido registrado. Inicie Sesión',
      });
      return;
    }

    // Creamos el usuario en firebase
    const usuarioCreado = await instance.add({
      nombre,
      email,
      password,
      token: '',
      tipo: '',
      config: {
        unidad: 'millas'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agregamos al documento recien creado el id como campo adicional (util para consultas en un futuro por ID).
    await instance.doc(usuarioCreado.id).update({
      uid: usuarioCreado.id,
    });

    res.status(201).json({
      error: false,
      code: 201,
      message: 'Usuario creado exitosamente',
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      code: 500,
      message: 'Ocurrio un error al crear el usuario: ' + error,
    });
  }

}


export async function getMe(req: Request, res: Response) {
  try {
    // checkAuth ya validó el token y cargó el usuario en req.user.
    res.status(200).json({
      error: false,
      code: 200,
      message: 'Sesión válida',
      data: {
        uid: req.user.uid,
        nombre: req.user.nombre,
        email: req.user.email,
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

export async function logInUser(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(404).json({
      code: 404,
      message: 'El correo y contraseña son obligatorios. Verifique'
    });
  }

  // ! Validar sintaxis de email

  // Validar longitud de contraseña (8 caracteres como minimo)
  if (password.length < 8) {
    return res.status(404).json({
      code: 404,
      error: true,
      message: 'La contraseña debe de tener 8 caracteres',
    });
  }

  try {
    const usuarioRef = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS).where('email', '==', email).limit(1).get();
    if (usuarioRef.size == 0) {
      return res.status(404).json({
        code: 404,
        error: true,
        message: 'No se encontró usuario registrado con el email proporcionado. Cree una cuenta',
      });
    }

    if (password.trim() != usuarioRef.docs[0].data().password) {
      return res.json({
        error: false,
        message: 'La contraseña es incorrecta',
      });
    }

    res.status(200).json({
      code: 200,
      error: false,
      message: 'Credenciales correctas. Bienvenido',
      usuario: {
        nombre: usuarioRef.docs[0].data().nombre,
        email: usuarioRef.docs[0].data().email,
        tipo: usuarioRef.docs[0].data().tipo,
      },
      token: generateJWT(usuarioRef.docs[0].data().uid),
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      code: 500,
      message: 'Error de autenticación',
    });
  }

}
