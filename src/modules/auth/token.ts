import jwt from 'jsonwebtoken';
import { ROLES, type Role } from '../../constants/domain.js';
import { env } from '../../config/env.js';

export type TokenPayload = { sub: string; role: Role };

const ALGORITHM = 'HS256';
const ISSUER = 'doctor-tracker-api';

export const tokenMaxAgeMs = env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000;

export function signToken(payload: TokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_SECRET, {
    subject: payload.sub,
    algorithm: ALGORITHM,
    issuer: ISSUER,
    expiresIn: Math.floor(tokenMaxAgeMs / 1000),
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
    });
    if (typeof decoded === 'string' || !decoded.sub) return null;
    const role = (decoded as { role?: unknown }).role;
    if (!ROLES.includes(role as Role)) return null;
    return { sub: decoded.sub, role: role as Role };
  } catch {
    return null;
  }
}
