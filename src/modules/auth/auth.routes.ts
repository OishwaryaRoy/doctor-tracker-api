import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { loginRateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, validate({ body: loginSchema }), controller.login);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
