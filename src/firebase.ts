import dotenv from 'dotenv';
dotenv.config();
import { applicationDefault, initializeApp } from 'firebase-admin/app';

// Modulos a utilizar
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';

// Inicializar app
initializeApp({
  // `aplicacionDefault()` buscara la variable de entorno con la ruta del archivo .json y hacer la conexion
  credential: applicationDefault(),
});

// Instancias de modulos
const db = getFirestore();
const messaging = getMessaging();
const auth = getAuth();


// exports
export default {
  db,
  messaging,
  auth,
};
