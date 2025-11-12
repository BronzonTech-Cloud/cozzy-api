import { Request, Response } from 'express';
import { DiscountType } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { handlePrismaError } from '../../utils/prisma-errors';

export async function listCoupons(req: Request, res: Response) {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ coupons });
}

export async function createCoupon(req: Request, res: Response) {
  try {
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

    // Runtime validation
    if (
      !couponData.code ||
      typeof couponData.code !== 'string' ||
      couponData.code.trim().length === 0
    ) {
      return res
        .status(400)
        .json({ message: 'Coupon code is required and must be a non-empty string' });
    }

    // Validate code format (alphanumeric and hyphens/underscores)
    const codePattern = /^[a-zA-Z0-9_-]+$/;
    if (!codePattern.test(couponData.code.trim())) {
      return res.status(400).json({
        message: 'Coupon code can only contain letters, numbers, hyphens, and underscores',
      });
    }

    if (
      !couponData.discountType ||
      !['PERCENTAGE', 'FIXED_AMOUNT'].includes(couponData.discountType)
    ) {
      return res
        .status(400)
        .json({ message: 'discountType must be either PERCENTAGE or FIXED_AMOUNT' });
    }

    if (
      !couponData.discountValue ||
      typeof couponData.discountValue !== 'number' ||
      !Number.isInteger(couponData.discountValue) ||
      couponData.discountValue <= 0
    ) {
      return res.status(400).json({ message: 'discountValue must be a positive integer' });
    }

    // Validate discountValue for PERCENTAGE type
    if (couponData.discountType === 'PERCENTAGE' && couponData.discountValue > 100) {
      return res.status(400).json({ message: 'discountValue must be <= 100 for PERCENTAGE type' });
    }

    // Validate optional numeric fields
    if (couponData.minPurchase !== undefined) {
      if (
        typeof couponData.minPurchase !== 'number' ||
        !Number.isInteger(couponData.minPurchase) ||
        couponData.minPurchase < 0
      ) {
        return res.status(400).json({ message: 'minPurchase must be a non-negative integer' });
      }
    }

    if (couponData.maxDiscount !== undefined) {
      if (
        typeof couponData.maxDiscount !== 'number' ||
        !Number.isInteger(couponData.maxDiscount) ||
        couponData.maxDiscount < 0
      ) {
        return res.status(400).json({ message: 'maxDiscount must be a non-negative integer' });
      }
    }

    if (couponData.usageLimit !== undefined) {
      if (
        typeof couponData.usageLimit !== 'number' ||
        !Number.isInteger(couponData.usageLimit) ||
        couponData.usageLimit < 0
      ) {
        return res.status(400).json({ message: 'usageLimit must be a non-negative integer' });
      }
    }

    // Check if code already exists
    const existing = await prisma.coupon.findUnique({ where: { code: couponData.code.trim() } });
    if (existing) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }

    // Validate dates with proper error handling
    let validFrom: Date;
    let validUntil: Date;
    try {
      validFrom = new Date(couponData.validFrom);
      validUntil = new Date(couponData.validUntil);

      // Check if dates are valid
      if (isNaN(validFrom.getTime())) {
        return res.status(400).json({ message: 'Invalid date format for validFrom' });
      }
      if (isNaN(validUntil.getTime())) {
        return res.status(400).json({ message: 'Invalid date format for validUntil' });
      }

      if (validUntil <= validFrom) {
        return res.status(400).json({ message: 'validUntil must be after validFrom' });
      }
    } catch {
      return res.status(400).json({ message: 'Invalid date format for validFrom or validUntil' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: couponData.code.trim(),
        description: couponData.description || null,
        discountType: couponData.discountType,
        discountValue: couponData.discountValue,
        minPurchase: couponData.minPurchase === undefined ? null : couponData.minPurchase,
        maxDiscount: couponData.maxDiscount === undefined ? null : couponData.maxDiscount,
        usageLimit: couponData.usageLimit === undefined ? null : couponData.usageLimit,
        validFrom,
        validUntil,
        active: couponData.active !== false,
      },
    });

    return res.status(201).json({ coupon });
  } catch (error) {
    // Handle Prisma errors
    if (handlePrismaError(error, res)) {
      return;
    }
    console.error(
      'Error in createCoupon:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function updateCoupon(req: Request, res: Response) {
  try {
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

    // Validate code is not empty if provided
    if (updateData.code !== undefined) {
      if (!updateData.code || updateData.code.trim().length === 0) {
        return res.status(400).json({ message: 'Coupon code cannot be empty' });
      }
    }

    // Validate discountValue if provided
    if (updateData.discountValue !== undefined) {
      if (!Number.isInteger(updateData.discountValue) || updateData.discountValue <= 0) {
        return res.status(400).json({ message: 'discountValue must be a positive integer' });
      }

      // If discountType is PERCENTAGE, validate discountValue <= 100
      const discountType = updateData.discountType ?? coupon.discountType;
      if (discountType === 'PERCENTAGE' && updateData.discountValue > 100) {
        return res
          .status(400)
          .json({ message: 'discountValue must be <= 100 for PERCENTAGE type' });
      }
    }

    // Validate if discountType is being changed to PERCENTAGE with existing discountValue > 100
    if (updateData.discountType === 'PERCENTAGE' && updateData.discountValue === undefined) {
      if (coupon.discountValue > 100) {
        return res.status(400).json({
          message: 'Cannot change discountType to PERCENTAGE: existing discountValue exceeds 100',
        });
      }
    }

    // Validate numeric fields are non-negative if provided
    if (updateData.minPurchase !== undefined) {
      if (!Number.isInteger(updateData.minPurchase) || updateData.minPurchase < 0) {
        return res.status(400).json({ message: 'minPurchase must be a non-negative integer' });
      }
    }

    if (updateData.maxDiscount !== undefined) {
      if (!Number.isInteger(updateData.maxDiscount) || updateData.maxDiscount < 0) {
        return res.status(400).json({ message: 'maxDiscount must be a non-negative integer' });
      }
    }

    if (updateData.usageLimit !== undefined) {
      if (!Number.isInteger(updateData.usageLimit) || updateData.usageLimit < 0) {
        return res.status(400).json({ message: 'usageLimit must be a non-negative integer' });
      }
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
      let validFrom: Date;
      let validUntil: Date;

      try {
        validFrom = updateData.validFrom ? new Date(updateData.validFrom) : coupon.validFrom;
        validUntil = updateData.validUntil ? new Date(updateData.validUntil) : coupon.validUntil;

        // Check if dates are valid
        if (updateData.validFrom && isNaN(validFrom.getTime())) {
          return res.status(400).json({ message: 'Invalid date format for validFrom' });
        }
        if (updateData.validUntil && isNaN(validUntil.getTime())) {
          return res.status(400).json({ message: 'Invalid date format for validUntil' });
        }

        if (validUntil <= validFrom) {
          return res.status(400).json({ message: 'validUntil must be after validFrom' });
        }
      } catch {
        return res.status(400).json({ message: 'Invalid date format for validFrom or validUntil' });
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
  } catch (error) {
    // Handle Prisma errors (e.g., unique constraint violations)
    if (handlePrismaError(error, res)) {
      return;
    }
    console.error(
      'Error in updateCoupon:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function deleteCoupon(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    // Check if coupon exists before deleting
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    await prisma.coupon.delete({ where: { id } });

    return res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    // Handle Prisma errors
    if (handlePrismaError(error, res)) {
      return;
    }
    console.error(
      'Error in deleteCoupon:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}

export async function validateCoupon(req: Request, res: Response) {
  try {
    const { code, totalCents } = req.body as { code: string; totalCents: number };

    // Validate input parameters
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    if (
      totalCents === undefined ||
      totalCents === null ||
      typeof totalCents !== 'number' ||
      !Number.isFinite(totalCents) ||
      totalCents < 0
    ) {
      return res
        .status(400)
        .json({ message: 'Valid total amount is required (must be a non-negative number)' });
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.trim() } });
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
    // Explicitly check for null/undefined to enforce usageLimit = 0
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    // Check minimum purchase
    if (coupon.minPurchase != null && totalCents < coupon.minPurchase) {
      return res.status(400).json({
        message: `Minimum purchase of ${coupon.minPurchase / 100} required`,
      });
    }

    // Calculate discount
    let discountCents = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountCents = Math.floor((totalCents * coupon.discountValue) / 100);
      // Explicitly check for null/undefined to enforce maxDiscount = 0
      if (coupon.maxDiscount != null) {
        discountCents = Math.min(discountCents, coupon.maxDiscount);
      }
    } else {
      // FIXED_AMOUNT
      discountCents = coupon.discountValue;
    }

    // Ensure discount doesn't exceed total
    discountCents = Math.min(discountCents, totalCents);

    // Note: This endpoint is for validation only, not application
    // The usage count is incremented when the coupon is actually applied during order creation
    // See orders.controller.ts for the actual application logic

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
  } catch (error) {
    console.error(
      'Error in validateCoupon:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
}
