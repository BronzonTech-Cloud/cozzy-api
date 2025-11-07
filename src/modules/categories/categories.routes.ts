import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import {
  createCategory,
  deleteCategory,
  getCategoryBySlug,
  listCategories,
  updateCategory,
} from './categories.controller';

export const categoriesRouter = Router();

categoriesRouter.get('/', listCategories);
categoriesRouter.get('/:slug', getCategoryBySlug);

categoriesRouter.post(
  '/',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: createCategorySchema }),
  createCategory,
);
categoriesRouter.patch(
  '/:id',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: updateCategorySchema }),
  updateCategory,
);
categoriesRouter.delete('/:id', authGuard, requireRole('ADMIN'), deleteCategory);
