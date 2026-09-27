import jwt from 'jsonwebtoken';
import config from '../environment';

function generateJWT(id: string | number) {
  return jwt.sign({ user: { uid: id } }, config.JWT_SECRET, { expiresIn: '7d' });
}

export default generateJWT;
