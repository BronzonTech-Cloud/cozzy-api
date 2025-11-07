import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createProductSchema, updateProductSchema } from './products.schema';
import {
  createProduct,
  deleteProduct,
  getProductBySlug,
  listProducts,
  updateProduct,
} from './products.controller';

export const productsRouter = Router();

productsRouter.get('/', listProducts);
productsRouter.get('/:slug', getProductBySlug);

productsRouter.post(
  '/',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: createProductSchema }),
  createProduct,
);
productsRouter.patch(
  '/:id',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: updateProductSchema }),
  updateProduct,
);
productsRouter.delete('/:id', authGuard, requireRole('ADMIN'), deleteProduct);
