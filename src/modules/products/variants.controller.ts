import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { createVariantSchema } from './variants.schema';

export async function getProductVariants(req: Request, res: Response) {
  try {
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
  } catch (error) {
    console.error(
      'Error in getProductVariants:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createProductVariant(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    // Input validation: validate payload before any DB operations
    const validationResult = createVariantSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation error',
        errors: validationResult.error.issues,
      });
    }

    // Use parsed/sanitized data from Zod validation
    // Zod schema already validates:
    // - name is present and non-empty (min(1))
    // - priceCents is a non-negative integer (min(0))
    // - stock is a non-negative integer (min(0))
    // - images is an array of valid URLs (array(z.string().url()))
    const variantData = validationResult.data;

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Attempt to create variant - catch Prisma unique constraint error (P2002) for SKU
    try {
      const variant = await prisma.productVariant.create({
        data: {
          productId: id,
          name: variantData.name,
          sku: variantData.sku || null,
          priceCents: variantData.priceCents ?? null,
          stock: variantData.stock ?? 0,
          images: variantData.images || [],
        },
      });

      return res.status(201).json({ variant });
    } catch (error: unknown) {
      // Handle Prisma unique constraint violation (P2002) for SKU
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
        error.meta.target.includes('sku')
      ) {
        return res.status(409).json({ message: 'SKU already exists' });
      }
      // Re-throw other errors
      throw error;
    }
  } catch (error) {
    console.error(
      'Error in createProductVariant:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'Internal server error' });
  }
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
