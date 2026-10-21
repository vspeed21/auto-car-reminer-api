import jwt from 'jsonwebtoken';
import config from '../environment';

function generateJWT(id: string) {
  return jwt.sign({ user: { uid: id } }, config.JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

export default generateJWT;
