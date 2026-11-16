import type { RequestHandler } from 'express';
import { AppError } from './error';
import { verifyAccessToken } from '../modules/auth/token';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing bearer token', 'UNAUTHORIZED'));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = {
      id: payload.sub,
      kind: payload.kind,
      role: payload.role,
      barangayId: payload.barangayId ?? null,
      email: payload.email
    };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};
