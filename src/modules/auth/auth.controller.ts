import type { CookieOptions, RequestHandler } from 'express';
import { env, isProduction } from '../../config/env.js';
import { input } from '../../middleware/validate.js';
import type { LoginInput } from './auth.schema.js';
import * as authService from './auth.service.js';
import { tokenMaxAgeMs } from './token.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

export const login: RequestHandler = async (req, res) => {
  const { user, token } = await authService.login(input.body<LoginInput>(req));
  res.cookie(env.COOKIE_NAME, token, { ...cookieOptions, maxAge: tokenMaxAgeMs });
  res.json({ data: { user, expiresAt: new Date(Date.now() + tokenMaxAgeMs).toISOString() } });
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json({ data: { user } });
};
