import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';

export type JwtUser = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
};

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing Authorization header' });
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token)
    return res.status(401).json({ message: 'Invalid Authorization header' });
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUser & {
      iat: number;
      exp: number;
    };
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(role: 'ADMIN' | 'USER') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (role === 'ADMIN' && req.user.role !== 'ADMIN')
      return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
