import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { getUser, listUsers } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authGuard, requireRole('ADMIN'));
usersRouter.get('/', listUsers);
usersRouter.get('/:id', getUser);
