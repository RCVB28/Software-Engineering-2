import type { RequestHandler } from 'express';
import { ActorType } from '@prisma/client';
import { prisma } from '../../config/database';
import { recordAudit } from './audit.service';

/**
 * Writes an audit entry after a successful (2xx) response for an administrative action.
 */
export function auditMiddleware(action: string, entityType: string): RequestHandler {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400 && req.user?.kind === 'ADMIN') {
        recordAudit(prisma, {
          actorType: ActorType.ADMIN,
          actorId: req.user.id,
          action,
          entityType,
          metadata: { method: req.method, path: req.originalUrl }
        }).catch(() => undefined);
      }
    });
    next();
  };
}
