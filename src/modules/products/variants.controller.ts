import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

export async function getProductVariants(req: Request, res: Response) {
  const { id } = req.params as { id: string };

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'asc' },
  });

  return res.json({ variants });
}

export async function createProductVariant(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const variantData = req.body as {
    name: string;
    sku?: string;
    priceCents?: number;
    stock?: number;
    images?: string[];
  };

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Check if SKU is unique (if provided)
  if (variantData.sku) {
    const existingVariant = await prisma.productVariant.findUnique({
      where: { sku: variantData.sku },
    });
    if (existingVariant) {
      return res.status(409).json({ message: 'SKU already exists' });
    }
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId: id,
      name: variantData.name,
      sku: variantData.sku || null,
      priceCents: variantData.priceCents || null,
      stock: variantData.stock || 0,
      images: variantData.images || [],
    },
  });

  return res.status(201).json({ variant });
}

export async function updateProductVariant(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const updateData = req.body as {
    name?: string;
    sku?: string;
    priceCents?: number;
    stock?: number;
    images?: string[];
  };

  const variant = await prisma.productVariant.findUnique({ where: { id } });
  if (!variant) {
    return res.status(404).json({ message: 'Variant not found' });
  }

  // Check if SKU is unique (if being updated)
  if (updateData.sku && updateData.sku !== variant.sku) {
    const existingVariant = await prisma.productVariant.findUnique({
      where: { sku: updateData.sku },
    });
    if (existingVariant) {
      return res.status(409).json({ message: 'SKU already exists' });
    }
  }

  const updatedVariant = await prisma.productVariant.update({
    where: { id },
    data: updateData,
  });

  return res.json({ variant: updatedVariant });
}

export async function deleteProductVariant(req: Request, res: Response) {
  const { id } = req.params as { id: string };

  const variant = await prisma.productVariant.findUnique({ where: { id } });
  if (!variant) {
    return res.status(404).json({ message: 'Variant not found' });
  }

  await prisma.productVariant.delete({ where: { id } });

  return res.json({ message: 'Variant deleted successfully' });
}

