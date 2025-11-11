import { Router } from 'express';

import { authGuard } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
} from '../../middleware/rate-limit';
import { login, me, refresh, register } from './auth.controller';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema';
import { forgotPassword, resetPassword } from './password-reset.controller';
import { forgotPasswordSchema, resetPasswordSchema } from './password-reset.schema';
import {
  requestVerificationEmail,
  resendVerificationEmail,
  verifyEmail,
} from './verification.controller';

export const authRouter = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       409:
 *         description: Email already in use
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
authRouter.post('/register', authLimiter, validate({ body: registerSchema }), register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
authRouter.post('/refresh', validate({ body: refreshSchema }), refresh);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
authRouter.get('/me', authGuard, me);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Request email verification
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Verification email sent. Please check your inbox.' }
 *       400:
 *         description: Email is already verified
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
authRouter.post('/verify-email', authGuard, emailVerificationLimiter, requestVerificationEmail);

/**
 * @swagger
 * /api/v1/auth/verify-email/{token}:
 *   get:
 *     summary: Verify email with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Email verified successfully' }
 *       400:
 *         description: Invalid or expired verification token
 */
authRouter.get('/verify-email/:token', emailVerificationLimiter, verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Verification email resent. Please check your inbox.' }
 *       400:
 *         description: Email is already verified
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
authRouter.post(
  '/resend-verification',
  authGuard,
  emailVerificationLimiter,
  resendVerificationEmail,
);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent (if email exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'If an account with that email exists, a password reset link has been sent.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  forgotPassword,
);

/**
 * @swagger
 * /api/v1/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Password reset successfully' }
 *       400:
 *         description: Invalid or expired reset token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Invalid or expired reset token' }
 */
authRouter.post(
  '/reset-password/:token',
  passwordResetLimiter,
  validate({ body: resetPasswordSchema }),
  resetPassword,
);
