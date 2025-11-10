import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

export async function getProfile(req: Request, res: Response) {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ user });
}

export async function updateProfile(req: Request, res: Response) {
  const userId = req.user!.id;
  const { name, email } = req.body as { name?: string; email?: string };

  // Check if email is being changed and if it's already in use
  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    // If email is changed, reset verification status
    const updateData: { name?: string; email?: string; emailVerified?: boolean } = {
      email,
      emailVerified: false,
    };
    if (name) updateData.name = name;
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        updatedAt: true,
      },
    });
    return res.json({ user });
  }

  // Only name is being updated
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      updatedAt: true,
    },
  });
  return res.json({ user });
}

export async function changePassword(req: Request, res: Response) {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return res.json({ message: 'Password changed successfully' });
}
