import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { invalidateCache } from '../../middleware/cache';
import { CreateProductInput, UpdateProductInput } from './products.schema';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

export async function listProducts(req: Request, res: Response) {
  const {
    page = '1',
    limit = '12',
    q,
    category,
    minPrice,
    maxPrice,
    active,
    sort,
  } = req.query as Record<string, string | undefined>;

  const take = Math.min(Number(limit) || 12, 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const where: NonNullable<Parameters<typeof prisma.product.findMany>[0]>['where'] = {};
  if (q)
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  if (category) where.category = { slug: category };
  if (typeof active !== 'undefined') where.active = active === 'true';
  if (minPrice || maxPrice)
    where.priceCents = {
      gte: minPrice ? Number(minPrice) : undefined,
      lte: maxPrice ? Number(maxPrice) : undefined,
    };

  const orderBy = (() => {
    switch (sort) {
      case 'price_asc':
        return { priceCents: 'asc' } as const;
      case 'price_desc':
        return { priceCents: 'desc' } as const;
      case 'newest':
      default:
        return { createdAt: 'desc' } as const;
    }
  })();

  const [items, total] = await Promise.all([
    prisma.product.findMany({ skip, take, where, orderBy, include: { category: true } }),
    prisma.product.count({ where }),
  ]);

  res.json({
    page: currentPage,
    limit: take,
    total,
    items,
  });
}

export async function getProductBySlug(req: Request, res: Response) {
  const { slug } = req.params as { slug: string };
  const product = await prisma.product.findUnique({ where: { slug }, include: { category: true } });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ product });
}

export async function createProduct(req: Request, res: Response) {
  const {
    title,
    description,
    priceCents,
    currency,
    sku,
    images = [],
    active = true,
    stock = 0,
    categoryId,
  } = req.body as CreateProductInput;
  const slug = slugify(title);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return res.status(409).json({ message: 'Product with similar title exists' });
  const product = await prisma.product.create({
    data: {
      title,
      description,
      priceCents,
      currency,
      sku,
      images,
      active,
      stock,
      slug,
      categoryId,
    },
  });

  // Invalidate product caches
  invalidateCache('products:.*');
  invalidateCache('product:.*');
  invalidateCache('search:.*');

  res.status(201).json({ product });
}

export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const body = req.body as UpdateProductInput;
  const data: Prisma.ProductUpdateInput = { ...body };
  if (body.title) data.slug = slugify(body.title);
  try {
    const product = await prisma.product.update({ where: { id }, data });

    // Invalidate product caches
    invalidateCache('products:.*');
    invalidateCache('product:.*');
    invalidateCache('search:.*');

    res.json({ product });
  } catch {
    res.status(404).json({ message: 'Product not found' });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  try {
    await prisma.product.delete({ where: { id } });

    // Invalidate product caches
    invalidateCache('products:.*');
    invalidateCache('product:.*');
    invalidateCache('search:.*');

    res.status(204).send();
  } catch {
    res.status(404).json({ message: 'Product not found' });
  }
}
