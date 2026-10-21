/* eslint-disable @typescript-eslint/no-explicit-any */
// Check if headers bring token in Autorization

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import environment from '../environment';
import firebase from '../firebase';
import { FIREBASE_COLLECTION_NAMES } from '../constants';

interface IDecoded {
  user: {
    uid: string
  }
  iat: number,
  exp: number,
}



async function checkAuth(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: true,
      code: 401,
      message: 'Sesión inválida. Inicie sesión de nuevo',
    });
  }

  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as unknown as IDecoded;

    if (!decoded?.user || typeof decoded.user.uid !== 'string') {
      return res.status(401).json({
        error: true,
        code: 401,
        message: 'Sesión inválida. Inicie sesión de nuevo',
      });
    }

    const usuarioRef = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS).where('uid', '==', decoded.user.uid).limit(1).get();

    if (usuarioRef.empty) {
      return res.status(401).json({
        error: true,
        code: 401,
        message: 'Sesión inválida. Inicie sesión de nuevo',
      });
    }

    req.user = usuarioRef.docs[0].data();

    return next();
  } catch (error: any) {
    const expirado = error?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: true,
      code: 401,
      message: expirado ? 'Sesión expirada. Inicie sesión de nuevo' : 'Sesión inválida. Inicie sesión de nuevo',
    });
  }
}

export default checkAuth;
