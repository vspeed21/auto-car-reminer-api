import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET?.trim();

if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET es obligatorio y debe tener al menos 32 bytes. Defínelo como variable de entorno o secreto.');
}

const environment = {
  JWT_SECRET: jwtSecret,
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY ?? ''
};

export default environment;
