import { Router } from 'express';

import { authGuard } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from './address.controller';
import { createAddressSchema, updateAddressSchema } from './address.schema';
import { changePassword, getProfile, updateProfile } from './profile.controller';
import { changePasswordSchema, updateProfileSchema } from './profile.schema';

export const profileRouter = Router();

profileRouter.use(authGuard);

/**
 * @swagger
 * /api/v1/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string, enum: [USER, ADMIN] }
 *                     emailVerified: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
profileRouter.get('/', getProfile);

/**
 * @swagger
 * /api/v1/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string, enum: [USER, ADMIN] }
 *                     emailVerified: { type: boolean }
 *                     updatedAt: { type: string, format: date-time }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Email already in use
 */
profileRouter.patch('/', validate({ body: updateProfileSchema }), updateProfile);

/**
 * @swagger
 * /api/v1/profile/password:
 *   patch:
 *     summary: Change user password
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword: { type: string, minLength: 1 }
 *               newPassword: { type: string, minLength: 8, maxLength: 100 }
 *               confirmPassword: { type: string, minLength: 8, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Password changed successfully' }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Current password is incorrect
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
profileRouter.patch('/password', validate({ body: changePasswordSchema }), changePassword);

/**
 * @swagger
 * /api/v1/profile/addresses:
 *   get:
 *     summary: Get user's addresses
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
profileRouter.get('/addresses', getAddresses);

/**
 * @swagger
 * /api/v1/profile/addresses:
 *   post:
 *     summary: Add a new address
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *     responses:
 *       201:
 *         description: Address created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   $ref: '#/components/schemas/Address'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
profileRouter.post('/addresses', validate({ body: createAddressSchema }), createAddress);

/**
 * @swagger
 * /api/v1/profile/addresses/{id}:
 *   patch:
 *     summary: Update an address
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Address ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *     responses:
 *       200:
 *         description: Address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   $ref: '#/components/schemas/Address'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
profileRouter.patch('/addresses/:id', validate({ body: updateAddressSchema }), updateAddress);

/**
 * @swagger
 * /api/v1/profile/addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Address ID
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Address deleted successfully' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
profileRouter.delete('/addresses/:id', deleteAddress);

