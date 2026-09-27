import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en producción. Defínelo como variable de entorno o secreto.');
}

const environment = {
  JWT_SECRET: process.env.JWT_SECRET ?? 'secret',
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY ?? ''
};

export default environment;
