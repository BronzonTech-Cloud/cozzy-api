import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.json({ users });
}

export async function getUser(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}
