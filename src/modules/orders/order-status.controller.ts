import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';

import { prisma } from '../../config/prisma';

export async function updateOrderStatus(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { status, note, trackingNumber } = req.body as {
    status: OrderStatus;
    note?: string;
    trackingNumber?: string;
  };

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Update order status and create history entry
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // Create status history entry
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status,
        note,
      },
    });

    // Update order
    const updateData: {
      status: OrderStatus;
      trackingNumber?: string;
      shippedAt?: Date;
      deliveredAt?: Date;
    } = { status };

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    // Set shippedAt when status changes to FULFILLED
    if (status === 'FULFILLED' && order.status !== 'FULFILLED') {
      updateData.shippedAt = new Date();
    }

    // Set deliveredAt when status changes to FULFILLED (can be updated later)
    if (status === 'FULFILLED' && !order.deliveredAt) {
      // This can be updated separately when actually delivered
    }

    return tx.order.update({
      where: { id },
      data: updateData,
      include: {
        items: { include: { product: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, email: true, name: true } },
      },
    });
  });

  return res.json({ order: updatedOrder });
}

export async function getOrderTracking(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'ADMIN';

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      statusHistory: { orderBy: { createdAt: 'desc' } },
      items: { include: { product: { select: { id: true, title: true, images: true } } } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check permissions
  if (!isAdmin && order.userId !== userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return res.json({
    order: {
      id: order.id,
      status: order.status,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      statusHistory: order.statusHistory,
      items: order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
}

export async function cancelOrder(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const userId = req.user!.id;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check if user owns the order
  if (order.userId !== userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Check if order can be cancelled (only PENDING or PAID orders)
  if (order.status !== 'PENDING' && order.status !== 'PAID') {
    return res.status(400).json({
      message: `Cannot cancel order with status ${order.status}. Only PENDING or PAID orders can be cancelled.`,
    });
  }

  // Cancel order and create history entry
  const cancelledOrder = await prisma.$transaction(async (tx) => {
    // Create status history entry
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: 'CANCELLED',
        note: 'Cancelled by user',
      },
    });

    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        items: { include: { product: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Restore stock for cancelled items
    for (const item of updatedOrder.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    return updatedOrder;
  });

  return res.json({ order: cancelledOrder });
}

export async function getOrderHistory(req: Request, res: Response) {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'ADMIN';
  const { status, startDate, endDate, limit, offset } = req.query as {
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
  };

  const where: {
    userId?: string;
    status?: OrderStatus;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  // Filter by user (unless admin viewing all)
  if (!isAdmin) {
    where.userId = userId;
  }

  // Filter by status
  if (status) {
    where.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const take = limit ? parseInt(limit, 10) : 20;
  const skip = offset ? parseInt(offset, 10) : 0;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        items: { include: { product: { select: { id: true, title: true, images: true } } } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 }, // Latest status
      },
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({
    orders,
    pagination: {
      total,
      limit: take,
      offset: skip,
      hasMore: skip + take < total,
    },
  });
}
