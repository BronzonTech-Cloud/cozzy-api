import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

export async function searchProducts(req: Request, res: Response) {
  const {
    q,
    categoryId,
    minPrice,
    maxPrice,
    inStock,
    sortBy,
    sortOrder,
    page,
    limit,
  } = req.query as {
    q?: string;
    categoryId?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: string;
    limit?: string;
  };

  const where: {
    active?: boolean;
    categoryId?: string;
    priceCents?: { gte?: number; lte?: number };
    stock?: { gt?: number };
    OR?: Array<{ title?: { contains: string; mode?: 'insensitive' }; description?: { contains: string; mode?: 'insensitive' } }>;
  } = {
    active: true,
  };

  // Text search
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Category filter
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Price range filter
  if (minPrice || maxPrice) {
    where.priceCents = {};
    if (minPrice) {
      where.priceCents.gte = parseInt(minPrice, 10);
    }
    if (maxPrice) {
      where.priceCents.lte = parseInt(maxPrice, 10);
    }
  }

  // Stock filter
  if (inStock === 'true') {
    where.stock = { gt: 0 };
  }

  // Sorting
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  if (sortBy) {
    const validSortFields = ['title', 'priceCents', 'createdAt', 'stock'];
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.createdAt = 'desc'; // Default
    }
  } else {
    orderBy.createdAt = 'desc'; // Default
  }

  // Pagination
  const pageNum = page ? parseInt(page, 10) : 1;
  const limitNum = limit ? parseInt(limit, 10) : 20;
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return res.json({
    products,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: skip + limitNum < total,
    },
  });
}

export async function getSearchSuggestions(req: Request, res: Response) {
  const { q } = req.query as { q?: string };

  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 10,
    select: {
      id: true,
      title: true,
      slug: true,
      images: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const suggestions = products.map((product) => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    image: product.images[0] || null,
  }));

  return res.json({ suggestions });
}

