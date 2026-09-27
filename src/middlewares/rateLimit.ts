import { rateLimit } from 'express-rate-limit';

/**
 * Freno contra fuerza bruta en autenticación.
 *
 * Cómo funciona:
 * - Cada IP tiene su propio contador. Cada petición a login/signup suma 1.
 * - `windowMs` define la ventana de tiempo: 15 minutos. Pasado ese tiempo
 *   el contador de la IP vuelve a 0 automáticamente (ventana deslizante
 *   aproximada: el límite se evalúa sobre los últimos 15 minutos).
 * - `limit` es el máximo permitido por ventana: 30 peticiones por IP.
 *   La petición 31 dentro de la misma ventana ya no llega al controlador:
 *   este middleware responde directo con 429.
 * - `standardHeaders: 'draft-7'` devuelve cabeceras RateLimit-* para que
 *   el cliente sepa su cupo; `legacyHeaders: false` apaga las antiguas X-RateLimit-*.
 * - `message` es el cuerpo del 429 con el formato { error, code, message }
 *   que usa toda la API, para que el frontend lo muestre igual que el resto.
 * - Solo protege login/signup (donde se pone como middleware). El contador
 *   vive en memoria del proceso: si el servidor reinicia, se resetea.
 *   Para múltiples instancias se usaría un store externo (ej. Redis).
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: true,
    code: 429,
    message: 'Ha sobrepasa los intentos permitidos. Intenta de nuevo en unos minutos',
  },
});
