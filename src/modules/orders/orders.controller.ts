import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { validateAndCalculateCoupon } from '../coupons/coupon-utils';

export async function createOrder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { items, currency, couponId } = req.body as {
    items: { productId: string; quantity: number }[];
    currency?: string;
    couponId?: string;
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

  // Move coupon validation and order creation into a single transaction to prevent TOCTOU
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Validate and apply coupon if provided (within transaction for atomicity)
      let discountCents = 0;
      let appliedCouponId: string | null = null;

      if (couponId) {
        // Look up coupon by ID within transaction
        const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
        if (!coupon) {
          throw new Error('COUPON_NOT_FOUND');
        }

        // Validate and calculate using the coupon object directly (avoids second DB lookup)
        const couponResult = await validateAndCalculateCoupon(coupon, subtotalCents);
        if (!couponResult.valid) {
          throw new Error(`COUPON_INVALID: ${couponResult.error || 'Invalid coupon'}`);
        }

        discountCents = couponResult.discountCents;
        appliedCouponId = coupon.id;
      }

      const totalCents = subtotalCents - discountCents;
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
      include: {
        items: true,
        coupon: {
          select: {
            id: true,
            code: true,
            description: true,
            discountType: true,
            discountValue: true,
            minPurchase: true,
            validFrom: true,
            validUntil: true,
            active: true,
          },
        },
      },
    });

    res.status(201).json({ order: orderWithRelations });
  } catch (error: unknown) {
    // Handle coupon validation errors
    if (error instanceof Error) {
      if (error.message === 'COUPON_NOT_FOUND') {
        return res.status(400).json({ message: 'Coupon not found' });
      }
      if (error.message.startsWith('COUPON_INVALID:')) {
        const errorMsg = error.message.replace('COUPON_INVALID: ', '');
        return res.status(400).json({ message: errorMsg });
      }
    }
    // Re-throw unexpected errors to be handled by error middleware
    console.error('Error in createOrder:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function listOrders(req: Request, res: Response) {
  const { all } = req.query as { all?: string };
  const isAdmin = req.user!.role === 'ADMIN';
  const where = isAdmin && all === 'true' ? {} : { userId: req.user!.id };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      coupon: {
        select: {
          id: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
          minPurchase: true,
          validFrom: true,
          validUntil: true,
          active: true,
        },
      },
    },
  });
  res.json({ orders });
}

export async function getOrder(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      coupon: {
        select: {
          id: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
          minPurchase: true,
          validFrom: true,
          validUntil: true,
          active: true,
        },
      },
    },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isAdmin && order.userId !== req.user!.id)
    return res.status(403).json({ message: 'Forbidden' });
  res.json({ order });
}
