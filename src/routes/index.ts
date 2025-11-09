import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes';
import { usersRouter } from '../modules/users/users.routes';
import { categoriesRouter } from '../modules/categories/categories.routes';
import { productsRouter } from '../modules/products/products.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { paymentsRouter } from '../modules/payments/payments.routes';
import { cartRouter } from '../modules/cart/cart.routes';
import { reviewsRouter } from '../modules/reviews/reviews.routes';
import { wishlistRouter } from '../modules/wishlist/wishlist.routes';
import { healthRouter } from '../modules/health/health.routes';

export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/categories', categoriesRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/payments', paymentsRouter);
router.use('/cart', cartRouter);
router.use('/', reviewsRouter); // Handles /products/:productId/reviews and /reviews/:reviewId
router.use('/wishlist', wishlistRouter);
