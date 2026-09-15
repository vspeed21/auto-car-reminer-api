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
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    const error = new Error('There isn\'t token in headers');
    return res.status(404).json({ message: error.message });
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, environment.JWT_SECRET) as IDecoded;
      console.log(decoded);
      const usuarioRef = await firebase.db.collection(FIREBASE_COLLECTION_NAMES.USUARIOS).where('uid', '==', decoded.user.uid).limit(1).get();
      req.user = usuarioRef.docs[0].data();
      // console.log(req.user);

      return next();
    } catch (error: any) {
      console.log(error);
      res.status(500).json({
        message: error.message,
      });
    }
  }
}

export default checkAuth;
