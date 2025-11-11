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

  // Input validation: ensure at least one field is provided
  if (!name && !email) {
    return res.status(400).json({ message: 'At least one field (name or email) must be provided' });
  }

  // Validate and normalize name if provided
  let validatedName: string | undefined;
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    if (trimmedName.length > 100) {
      return res.status(400).json({ message: 'Name must be 100 characters or less' });
    }
    validatedName = trimmedName;
  }

  // Validate email format if provided
  let validatedEmail: string | undefined;
  if (email !== undefined) {
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail.length === 0) {
      return res.status(400).json({ message: 'Email cannot be empty' });
    }
    // Simple RFC-lite email validation regex
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    validatedEmail = trimmedEmail;
  }

  // Get current user to check if email is actually changing
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!currentUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Build update data with validated values (never write undefined)
  const updateData: { name?: string; email?: string; emailVerified?: boolean } = {};

  // Add validated name if provided
  if (validatedName !== undefined) {
    updateData.name = validatedName;
  }

  // Handle email update - only reset verification if email is actually changing
  if (validatedEmail !== undefined) {
    // Only reset verification if email is actually changing
    if (validatedEmail !== currentUser.email) {
      updateData.email = validatedEmail;
      updateData.emailVerified = false;
    }
    // If email is the same, don't include it in updateData to avoid unnecessary update
  }

  try {
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
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation (P2002)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002' &&
      'meta' in error &&
      error.meta &&
      typeof error.meta === 'object' &&
      'target' in error.meta &&
      Array.isArray(error.meta.target) &&
      error.meta.target.includes('email')
    ) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    // Re-throw other errors
    throw error;
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    // Input validation: ensure both fields are present
    if (
      !currentPassword ||
      typeof currentPassword !== 'string' ||
      currentPassword.trim().length === 0
    ) {
      return res.status(400).json({ message: 'Current password is required' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length === 0) {
      return res.status(400).json({ message: 'New password is required' });
    }

    // Enforce minimum password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    // Ensure new password differs from current password
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ message: 'New password must be different from current password' });
    }

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
  } catch (error) {
    console.error(
      'Error in changePassword:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}
