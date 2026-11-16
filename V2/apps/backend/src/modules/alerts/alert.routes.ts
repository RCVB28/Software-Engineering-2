import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';
import {
  confirmAlertHandler,
  createAlertHandler,
  getAlertHandler,
  listAlertsHandler,
  listDeliveriesHandler,
  previewRecipientsHandler,
  updateAlertHandler
} from './alert.controller';

export const alertRouter = Router();

alertRouter.use('/admin/alerts', authenticate, requireAdmin);

alertRouter.get('/admin/alerts', listAlertsHandler);
alertRouter.post('/admin/alerts', createAlertHandler);
alertRouter.get('/admin/alerts/:alertId', getAlertHandler);
alertRouter.patch('/admin/alerts/:alertId', updateAlertHandler);
alertRouter.get('/admin/alerts/:alertId/recipients', previewRecipientsHandler);
alertRouter.post('/admin/alerts/:alertId/confirm', confirmAlertHandler);
alertRouter.get('/admin/alerts/:alertId/deliveries', listDeliveriesHandler);
