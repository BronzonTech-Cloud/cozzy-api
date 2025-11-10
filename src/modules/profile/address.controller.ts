import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

export async function getAddresses(req: Request, res: Response) {
  const userId = req.user!.id;
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return res.json({ addresses });
}

export async function createAddress(req: Request, res: Response) {
  const userId = req.user!.id;
  const addressData = req.body as {
    label: string;
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    state?: string;
    zipCode: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  };

  // If this is set as default, unset other default addresses
  if (addressData.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      ...addressData,
      userId,
      country: addressData.country || 'US',
    },
  });

  return res.status(201).json({ address });
}

export async function updateAddress(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };
  const updateData = req.body as {
    label?: string;
    firstName?: string;
    lastName?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  };

  // Check if address belongs to user
  const existingAddress = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!existingAddress) {
    return res.status(404).json({ message: 'Address not found' });
  }

  // If setting as default, unset other default addresses
  if (updateData.isDefault === true) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id },
    data: updateData,
  });

  return res.json({ address });
}

export async function deleteAddress(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };

  const address = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!address) {
    return res.status(404).json({ message: 'Address not found' });
  }

  await prisma.address.delete({ where: { id } });

  return res.json({ message: 'Address deleted successfully' });
}

