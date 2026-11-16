import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin, requireResident, requireRoles } from '../../middleware/rbac';
import {
  escalateReportHandler,
  getReportHandler,
  listReportsHandler,
  submitReportHandler,
  updateReportStatusHandler
} from './report.controller';

export const reportRouter = Router();

reportRouter.post('/reports', authenticate, requireResident, submitReportHandler);

reportRouter.get('/admin/reports', authenticate, requireAdmin, listReportsHandler);
reportRouter.get('/admin/reports/:reportId', authenticate, requireAdmin, getReportHandler);
reportRouter.patch(
  '/admin/reports/:reportId/status',
  authenticate,
  requireAdmin,
  updateReportStatusHandler
);
reportRouter.post(
  '/admin/reports/:reportId/escalate',
  authenticate,
  requireAdmin,
  requireRoles('HIGH_LEVEL'),
  escalateReportHandler
);
