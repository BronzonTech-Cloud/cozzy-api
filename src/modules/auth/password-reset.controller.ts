import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { sendEmail } from '../../utils/email';
import { resetPasswordSchema } from './password-reset.schema';

// Generate a secure random token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body as { email: string };

    // Validate email format
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Trim and lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Basic email validation pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
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

    // Validate APP_URL is set (required for production)
    if (!env.APP_URL) {
      console.error('APP_URL environment variable is not set');
      return res
        .status(500)
        .json({ message: 'Server configuration error. Please contact support.' });
    }

    // Send password reset email BEFORE saving token to database
    // This ensures the user receives the email before we commit the token
    const resetUrl = `${env.APP_URL}/api/v1/auth/reset-password/${resetToken}`;
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

    // Save token to database only after email is sent successfully
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetTokenExpires,
      },
    });

    return res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    // Log error without exposing sensitive details
    console.error(
      'Error in forgotPassword:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token } = req.params as { token: string };
    const { password } = req.body as { password: string };

    // Validate token format (64-character hex string from crypto.randomBytes(32).toString('hex'))
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Token should be a 64-character hex string (32 bytes = 64 hex characters)
    // But we'll check this after trying to find the user, to provide consistent error messages
    const sanitizedToken = token.trim();

    // Validate password using schema
    const validationResult = resetPasswordSchema.safeParse({ password });
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation error',
        errors: validationResult.error.issues,
      });
    }

    // Additional password complexity validation
    const passwordValue = validationResult.data.password;
    const hasUpperCase = /[A-Z]/.test(passwordValue);
    const hasLowerCase = /[a-z]/.test(passwordValue);
    const hasNumbers = /\d/.test(passwordValue);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordValue);

    // Require at least 3 of 4 complexity requirements
    const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(
      Boolean,
    ).length;
    if (complexityCount < 3) {
      return res.status(400).json({
        message:
          'Password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, special characters',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: sanitizedToken,
        resetPasswordExpires: {
          gt: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password using validated password
    const passwordHash = await bcrypt.hash(passwordValue, 10);

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
  } catch (error) {
    // Log error without exposing sensitive details
    console.error(
      'Error in resetPassword:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'Internal server error' });
  }
}
