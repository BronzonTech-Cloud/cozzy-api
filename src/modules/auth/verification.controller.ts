import crypto from 'crypto';
import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { sendEmail } from '../../utils/email';

// Generate a secure random token
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email using email service
async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${env.APP_URL || 'http://localhost:4000'}/api/v1/auth/verify-email/${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <h2>Verify Your Email Address</h2>
      <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
    `,
    text: `Verify Your Email Address\n\nClick this link to verify your email: ${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.`,
  });
}

export async function requestVerificationEmail(req: Request, res: Response) {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.emailVerified) {
    return res.status(400).json({ message: 'Email is already verified' });
  }

  // Generate verification token
  const verificationToken = generateVerificationToken();
  const verificationTokenExpires = new Date();
  verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24); // 24 hours

  // Save token to database
  await prisma.user.update({
    where: { id: userId },
    data: {
      verificationToken,
      verificationTokenExpires,
    },
  });

  // Send verification email
  await sendVerificationEmail(user.email, verificationToken);

  return res.json({
    message: 'Verification email sent. Please check your inbox.',
  });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.params as { token: string };

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationTokenExpires: {
        gt: new Date(), // Token not expired
      },
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification token' });
  }

  // Verify email
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
    },
  });

  return res.json({ message: 'Email verified successfully' });
}

export async function resendVerificationEmail(req: Request, res: Response) {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.emailVerified) {
    return res.status(400).json({ message: 'Email is already verified' });
  }

  // Generate new verification token
  const verificationToken = generateVerificationToken();
  const verificationTokenExpires = new Date();
  verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24); // 24 hours

  // Save token to database
  await prisma.user.update({
    where: { id: userId },
    data: {
      verificationToken,
      verificationTokenExpires,
    },
  });

  // Send verification email
  await sendVerificationEmail(user.email, verificationToken);

  return res.json({
    message: 'Verification email resent. Please check your inbox.',
  });
}
