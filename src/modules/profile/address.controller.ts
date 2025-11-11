import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { createAddressSchema, updateAddressSchema } from './address.schema';

export async function getAddresses(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json({ addresses });
  } catch (error) {
    console.error(
      'Error in getAddresses:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'Failed to fetch addresses' });
  }
}

export async function createAddress(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Validate request body with Zod
    const validationResult = createAddressSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation error',
        errors: validationResult.error.issues,
      });
    }

    // Use parsed/sanitized data from Zod validation
    const addressData = validationResult.data;

    // Execute all operations in a single transaction to avoid race conditions
    const address = await prisma.$transaction(async (tx) => {
      // If this is set as default, unset other default addresses
      if (addressData.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Create the new address
      return await tx.address.create({
        data: {
          ...addressData,
          userId,
          country: addressData.country || 'US',
        },
      });
    });

    return res.status(201).json({ address });
  } catch (error) {
    console.error(
      'Error in createAddress:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function updateAddress(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    // Validate request body with Zod
    const validationResult = updateAddressSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation error',
        errors: validationResult.error.issues,
      });
    }

    // Filter out undefined values to avoid overwriting with defaults
    // Only include fields that were actually provided in req.body
    const updateData: Record<string, unknown> = {};
    const bodyKeys = Object.keys(req.body);
    for (const key of bodyKeys) {
      if (key in validationResult.data && validationResult.data[key as keyof typeof validationResult.data] !== undefined) {
        updateData[key] = validationResult.data[key as keyof typeof validationResult.data];
      }
    }

    // Execute all operations in a single transaction to avoid TOCTOU
    const address = await prisma.$transaction(async (tx) => {
      // Check if address belongs to user
      const existingAddress = await tx.address.findUnique({
        where: { id },
      });

      if (!existingAddress || existingAddress.userId !== userId) {
        throw new Error('NOT_FOUND');
      }

      // If setting as default, unset other default addresses
      if (updateData.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      // Update the address - cast updateData to Prisma's expected type
      return await tx.address.update({
        where: { id },
        data: updateData as Parameters<typeof tx.address.update>[0]['data'],
      });
    });

    return res.json({ address });
  } catch (error: unknown) {
    // Handle NOT_FOUND error from transaction
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Address not found' });
    }

    console.error(
      'Error in updateAddress:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function deleteAddress(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    // Perform atomic delete with userId in where clause (only owner can delete)
    const deleteResult = await prisma.address.deleteMany({
      where: { id, userId },
    });

    // If no record was deleted, address doesn't exist or doesn't belong to user
    if (deleteResult.count === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    return res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error(
      'Error in deleteAddress:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}
