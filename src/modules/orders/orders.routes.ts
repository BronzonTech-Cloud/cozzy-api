import { Router } from 'express';

import { authGuard } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createOrderSchema } from './orders.schema';
import { createOrder, getOrder, listOrders } from './orders.controller';

export const ordersRouter = Router();

ordersRouter.use(authGuard);
ordersRouter.post('/', validate({ body: createOrderSchema }), createOrder);
ordersRouter.get('/', listOrders);
ordersRouter.get('/:id', getOrder);
