import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body as { email: string; password: string; name: string };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, name, role: 'USER' } });

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });

  return res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  });
}

export async function me(req: Request, res: Response) {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ user });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken: string };
  try {
    const payload = verifyRefreshToken(refreshToken) as {
      id: string;
      email: string;
      role: 'USER' | 'ADMIN';
    };
    const accessToken = signAccessToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    const newRefreshToken = signRefreshToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });
    return res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}
