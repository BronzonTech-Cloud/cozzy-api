import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { validateAndCalculateCoupon } from '../coupons/coupon-utils';

export async function createOrder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { items, currency, couponCode } = req.body as {
    items: { productId: string; quantity: number }[];
    currency?: string;
    couponCode?: string;
  };

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
  const idToProduct = new Map(products.map((p) => [p.id, p] as const));

  for (const item of items) {
    const product = idToProduct.get(item.productId);
    if (!product) return res.status(400).json({ message: `Invalid product ${item.productId}` });
    if (product.stock < item.quantity)
      return res.status(400).json({ message: `Insufficient stock for product ${product.title}` });
  }

  const subtotalCents = items.reduce(
    (acc, it) => acc + idToProduct.get(it.productId)!.priceCents * it.quantity,
    0,
  );
  const itemsCount = items.reduce((acc, it) => acc + it.quantity, 0);

  // Validate and apply coupon if provided
  let discountCents = 0;
  let appliedCouponId: string | null = null;
  if (couponCode) {
    const couponResult = await validateAndCalculateCoupon(couponCode, subtotalCents);
    if (!couponResult.valid) {
      return res.status(400).json({ message: couponResult.error || 'Invalid coupon' });
    }
    discountCents = couponResult.discountCents;
    // Get coupon ID from the result
    if (couponResult.coupon) {
      appliedCouponId = couponResult.coupon.id;
    }
  }

  const totalCents = subtotalCents - discountCents;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalCents,
        currency: currency || 'USD',
        itemsCount,
        paymentProvider: 'STRIPE',
        couponId: appliedCouponId,
        discountCents,
      },
    });

    // Create initial status history entry
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        note: 'Order created',
      },
    });

    for (const item of items) {
      const product = idToProduct.get(item.productId)!;
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
          subtotalCents: product.priceCents * item.quantity,
        },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Increment coupon usage count if coupon was applied
    if (appliedCouponId) {
      await tx.coupon.update({
        where: { id: appliedCouponId },
        data: { usageCount: { increment: 1 } },
      });
    }

    return order;
  });

  // Fetch the order with relations for the response
  const orderWithRelations = await prisma.order.findUnique({
    where: { id: result.id },
    include: { items: true, coupon: true },
  });

  res.status(201).json({ order: orderWithRelations });
}

export async function listOrders(req: Request, res: Response) {
  const { all } = req.query as { all?: string };
  const isAdmin = req.user!.role === 'ADMIN';
  const where = isAdmin && all === 'true' ? {} : { userId: req.user!.id };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true, coupon: true },
  });
  res.json({ orders });
}

export async function getOrder(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, coupon: true },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isAdmin && order.userId !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });
  res.json({ order });
}
