import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { AddToCartInput, UpdateCartItemInput } from './cart.schema';

/**
 * Get or create user's cart
 */
async function getOrCreateCart(userId: string) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

/**
 * Get user's cart
 * GET /api/v1/cart
 */
export async function getCart(req: Request, res: Response) {
  const userId = req.user!.id;

  const cart = await getOrCreateCart(userId);

  // Calculate totals
  const totalCents = cart.items.reduce((sum, item) => {
    return sum + item.product.priceCents * item.quantity;
  }, 0);

  const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  res.json({
    cart: {
      ...cart,
      totalCents,
      itemsCount,
    },
  });
}

/**
 * Add item to cart
 * POST /api/v1/cart
 */
export async function addToCart(req: Request, res: Response) {
  const userId = req.user!.id;
  const { productId, quantity } = req.body as AddToCartInput;

  // Verify product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  if (!product.active) {
    return res.status(400).json({ message: 'Product is not available' });
  }

  // Check stock availability
  if (product.stock < quantity) {
    return res.status(400).json({
      message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`,
    });
  }

  // Get or create cart
  const cart = await getOrCreateCart(userId);

  // Check if item already exists in cart
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
  });

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;

    // Check stock again with new quantity
    if (product.stock < newQuantity) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${product.stock}, Requested: ${newQuantity}`,
      });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    return res.json({ item: updatedItem });
  }

  // Create new cart item
  const cartItem = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId,
      quantity,
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  res.status(201).json({ item: cartItem });
}

/**
 * Update cart item quantity
 * PATCH /api/v1/cart/:itemId
 */
export async function updateCartItem(req: Request, res: Response) {
  const userId = req.user!.id;
  const { itemId } = req.params as { itemId: string };
  const { quantity } = req.body as UpdateCartItemInput;

  // Get user's cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: true,
    },
  });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  // Find cart item
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: {
      product: true,
    },
  });

  if (!cartItem || cartItem.cartId !== cart.id) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  // Verify product is still active
  if (!cartItem.product.active) {
    return res.status(400).json({ message: 'Product is no longer available' });
  }

  // Check stock availability
  if (cartItem.product.stock < quantity) {
    return res.status(400).json({
      message: `Insufficient stock. Available: ${cartItem.product.stock}, Requested: ${quantity}`,
    });
  }

  // Update quantity
  const updatedItem = await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  res.json({ item: updatedItem });
}

/**
 * Remove item from cart
 * DELETE /api/v1/cart/:itemId
 */
export async function removeCartItem(req: Request, res: Response) {
  const userId = req.user!.id;
  const { itemId } = req.params as { itemId: string };

  // Get user's cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  // Find cart item
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: itemId },
  });

  if (!cartItem || cartItem.cartId !== cart.id) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  // Delete cart item
  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  res.status(204).send();
}

/**
 * Clear entire cart
 * DELETE /api/v1/cart
 */
export async function clearCart(req: Request, res: Response) {
  const userId = req.user!.id;

  // Get user's cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  // Delete all cart items
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  res.status(204).send();
}
