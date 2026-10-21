import { Request, Response, NextFunction } from 'express';

/**
 * Autoriza solo a los UIDs listados en ADMIN_UIDS (separados por coma).
 * Debe ejecutarse despues de checkAuth para que req.user exista.
 * Si ADMIN_UIDS no esta definido, todos los endpoints quedan bloqueados.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const admins = (process.env.ADMIN_UIDS ?? '')
    .split(',')
    .map(uid => uid.trim())
    .filter(Boolean);

  const uid = req.user?.uid;

  if (!uid || !admins.includes(uid)) {
    return res.status(403).json({
      error: true,
      code: 403,
      message: 'No tienes permisos para ejecutar esta acción',
    });
  }

  return next();
}

export default requireAdmin;
