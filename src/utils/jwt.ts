import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';

type Payload = Record<string, unknown>;

export function signAccessToken(payload: Payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as unknown as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: Payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as unknown as SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
