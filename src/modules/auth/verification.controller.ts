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
async function sendVerificationEmail(email: string, token: string): Promise<void> {
  // Validate APP_URL is set (required for production)
  if (!env.APP_URL) {
    console.error('APP_URL environment variable is not set');
    throw new Error('Server configuration error');
  }

  try {
    const verificationUrl = `${env.APP_URL}/api/v1/auth/verify-email/${token}`;
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
  } catch (error) {
    console.error(
      'Failed to send verification email:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    throw new Error('Failed to send verification email');
  }
}

// Helper function to generate and send verification token
// Uses atomic update to prevent race conditions
async function generateAndSendVerificationToken(userId: string, userEmail: string): Promise<void> {
  // Generate verification token
  const verificationToken = generateVerificationToken();
  const verificationTokenExpires = new Date();
  verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24); // 24 hours

  // Atomic update: only update if emailVerified is still false
  const updateResult = await prisma.user.updateMany({
    where: {
      id: userId,
      emailVerified: false, // Only update if not already verified
    },
    data: {
      verificationToken,
      verificationTokenExpires,
    },
  });

  // Check if update was successful (at least one row updated)
  if (updateResult.count === 0) {
    // Fetch user to determine the specific reason for failure
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    // If we get here, something unexpected happened
    throw new Error('Failed to update verification token');
  }

  // Send verification email - if this fails, clean up the token
  try {
    await sendVerificationEmail(userEmail, verificationToken);
  } catch (error) {
    // Clean up the token if email sending failed
    // Use a where clause that includes id and verificationToken to avoid clobbering concurrent tokens
    await prisma.user.updateMany({
      where: {
        id: userId,
        verificationToken, // Only clear this specific token
      },
      data: {
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    // Re-throw the email error so callers see the failure
    throw error;
  }
}

export async function requestVerificationEmail(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Find user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(409).json({ message: 'Email is already verified' });
    }

    // Generate and send verification token (atomic update prevents race conditions)
    try {
      await generateAndSendVerificationToken(userId, user.email);
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message === 'Email already verified') {
          return res.status(409).json({ message: 'Email is already verified' });
        }
        if (error.message === 'User not found') {
          return res.status(404).json({ message: 'User not found' });
        }
        if (error.message === 'Server configuration error') {
          return res
            .status(500)
            .json({ message: 'Server configuration error. Please contact support.' });
        }
      }
      // If email sending failed, log and return error
      console.error('Error generating/sending verification token:', error);
      return res
        .status(500)
        .json({ message: 'Failed to send verification email. Please try again later.' });
    }

    return res.json({
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error(
      'Error in requestVerificationEmail:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.params as { token: string };

    // Atomic update: only update if token is valid, not expired, and email not yet verified
    // This prevents TOCTOU vulnerability where concurrent requests could use the same token
    const updateResult = await prisma.user.updateMany({
      where: {
        verificationToken: token,
        verificationTokenExpires: {
          gt: new Date(), // Token not expired
        },
        emailVerified: false, // Only if not already verified
      },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    if (updateResult.count === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    return res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error(
      'Error in verifyEmail:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function resendVerificationEmail(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Find user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(409).json({ message: 'Email is already verified' });
    }

    // Generate and send verification token (atomic update prevents race conditions)
    try {
      await generateAndSendVerificationToken(userId, user.email);
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message === 'Email already verified') {
          return res.status(409).json({ message: 'Email is already verified' });
        }
        if (error.message === 'User not found') {
          return res.status(404).json({ message: 'User not found' });
        }
        if (error.message === 'Server configuration error') {
          return res
            .status(500)
            .json({ message: 'Server configuration error. Please contact support.' });
        }
      }
      // If email sending failed, log and return error
      console.error('Error generating/sending verification token:', error);
      return res
        .status(500)
        .json({ message: 'Failed to send verification email. Please try again later.' });
    }

    return res.json({
      message: 'Verification email resent. Please check your inbox.',
    });
  } catch (error) {
    console.error(
      'Error in resendVerificationEmail:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}
