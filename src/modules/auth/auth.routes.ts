import { Router } from 'express';

import { validate } from '../../middleware/validate';
import { authGuard } from '../../middleware/auth';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema';
import { login, me, refresh, register } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), register);
authRouter.post('/login', validate({ body: loginSchema }), login);
authRouter.post('/refresh', validate({ body: refreshSchema }), refresh);
authRouter.get('/me', authGuard, me);
