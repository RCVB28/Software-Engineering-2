import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin, requireRoles } from '../../middleware/rbac';
import { listAuditHandler } from './audit.controller';

export const auditRouter = Router();

auditRouter.get(
  '/admin/audit',
  authenticate,
  requireAdmin,
  requireRoles('SUPERADMIN', 'HIGH_LEVEL'),
  listAuditHandler
);
