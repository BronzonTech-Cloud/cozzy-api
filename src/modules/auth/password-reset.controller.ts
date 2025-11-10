import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { sendEmail } from '../../utils/email';

// Generate a secure random token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal if email exists or not (security best practice)
    return res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }

  // Generate reset token
  const resetToken = generateResetToken();
  const resetTokenExpires = new Date();
  resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour expiration

  // Save token to database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetTokenExpires,
    },
  });

  // Send password reset email
  const resetUrl = `${env.APP_URL || 'http://localhost:4000'}/api/v1/auth/reset-password/${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
    text: `Password Reset Request\n\nClick this link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
  });

  return res.json({
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token } = req.params as { token: string };
  const { password } = req.body as { password: string };

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: {
        gt: new Date(), // Token not expired
      },
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(password, 10);

  // Update password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  return res.json({ message: 'Password reset successfully' });
}

