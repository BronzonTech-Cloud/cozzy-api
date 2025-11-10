import { Request, Response } from 'express';
import { DiscountType } from '@prisma/client';

import { prisma } from '../../config/prisma';

export async function listCoupons(req: Request, res: Response) {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ coupons });
}

export async function createCoupon(req: Request, res: Response) {
  const couponData = req.body as {
    code: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    minPurchase?: number;
    maxDiscount?: number;
    usageLimit?: number;
    validFrom: string;
    validUntil: string;
    active?: boolean;
  };

  // Check if code already exists
  const existing = await prisma.coupon.findUnique({ where: { code: couponData.code } });
  if (existing) {
    return res.status(409).json({ message: 'Coupon code already exists' });
  }

  // Validate dates
  const validFrom = new Date(couponData.validFrom);
  const validUntil = new Date(couponData.validUntil);
  if (validUntil <= validFrom) {
    return res.status(400).json({ message: 'validUntil must be after validFrom' });
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: couponData.code,
      description: couponData.description || null,
      discountType: couponData.discountType,
      discountValue: couponData.discountValue,
      minPurchase: couponData.minPurchase || null,
      maxDiscount: couponData.maxDiscount || null,
      usageLimit: couponData.usageLimit || null,
      validFrom,
      validUntil,
      active: couponData.active !== false,
    },
  });

  return res.status(201).json({ coupon });
}

export async function updateCoupon(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const updateData = req.body as {
    code?: string;
    description?: string;
    discountType?: DiscountType;
    discountValue?: number;
    minPurchase?: number;
    maxDiscount?: number;
    usageLimit?: number;
    validFrom?: string;
    validUntil?: string;
    active?: boolean;
  };

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  // Check if code is being updated and if it's unique
  if (updateData.code && updateData.code !== coupon.code) {
    const existing = await prisma.coupon.findUnique({ where: { code: updateData.code } });
    if (existing) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }
  }

  // Validate dates if being updated
  if (updateData.validFrom || updateData.validUntil) {
    const validFrom = updateData.validFrom ? new Date(updateData.validFrom) : coupon.validFrom;
    const validUntil = updateData.validUntil ? new Date(updateData.validUntil) : coupon.validUntil;
    if (validUntil <= validFrom) {
      return res.status(400).json({ message: 'validUntil must be after validFrom' });
    }
  }

  const updatedCoupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...updateData,
      validFrom: updateData.validFrom ? new Date(updateData.validFrom) : undefined,
      validUntil: updateData.validUntil ? new Date(updateData.validUntil) : undefined,
    },
  });

  return res.json({ coupon: updatedCoupon });
}

export async function deleteCoupon(req: Request, res: Response) {
  const { id } = req.params as { id: string };

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  await prisma.coupon.delete({ where: { id } });

  return res.json({ message: 'Coupon deleted successfully' });
}

export async function validateCoupon(req: Request, res: Response) {
  const { code, totalCents } = req.body as { code: string; totalCents: number };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  // Check if coupon is active
  if (!coupon.active) {
    return res.status(400).json({ message: 'Coupon is not active' });
  }

  // Check validity dates
  const now = new Date();
  if (now < coupon.validFrom) {
    return res.status(400).json({ message: 'Coupon is not yet valid' });
  }
  if (now > coupon.validUntil) {
    return res.status(400).json({ message: 'Coupon has expired' });
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return res.status(400).json({ message: 'Coupon usage limit reached' });
  }

  // Check minimum purchase
  if (coupon.minPurchase && totalCents < coupon.minPurchase) {
    return res.status(400).json({
      message: `Minimum purchase of ${coupon.minPurchase / 100} required`,
    });
  }

  // Calculate discount
  let discountCents = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountCents = Math.floor((totalCents * coupon.discountValue) / 100);
    if (coupon.maxDiscount) {
      discountCents = Math.min(discountCents, coupon.maxDiscount);
    }
  } else {
    // FIXED_AMOUNT
    discountCents = coupon.discountValue;
  }

  // Ensure discount doesn't exceed total
  discountCents = Math.min(discountCents, totalCents);

  return res.json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
    discountCents,
    finalTotalCents: totalCents - discountCents,
  });
}
