import type { RequestHandler } from 'express';
import { AppError } from './error';
import type { Principal } from '../types/auth';

export const requireKind =
  (kind: Principal['kind']): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || req.user.kind !== kind) {
      next(new AppError(403, 'Forbidden for this account type', 'FORBIDDEN'));
      return;
    }
    next();
  };

export const requireRoles =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'Forbidden for this role', 'FORBIDDEN'));
      return;
    }
    next();
  };

export const requireAdmin = requireKind('ADMIN');
export const requireResident = requireKind('RESIDENT');

/**
 * Returns the barangay a LOW_LEVEL admin is restricted to, or undefined when the principal may
 * access the whole locality.
 */
export function adminBarangayScope(principal: Principal): string | undefined {
  return principal.role === 'LOW_LEVEL' ? principal.barangayId ?? '__none__' : undefined;
}
