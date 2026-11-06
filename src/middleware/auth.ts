import type { RequestHandler } from 'express';
import type { Role } from '../constants/domain.js';
import { env } from '../config/env.js';
import { verifyToken } from '../modules/auth/token.js';
import { ApiError } from '../utils/ApiError.js';

function readToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const cookieToken = req.cookies?.[env.COOKIE_NAME] as string | undefined;
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return undefined;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next(ApiError.unauthorized());

  const payload = verifyToken(token);
  if (!payload)
    return next(ApiError.unauthorized('Your session has expired. Please sign in again.'));

  req.user = { id: payload.sub, role: payload.role };
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
