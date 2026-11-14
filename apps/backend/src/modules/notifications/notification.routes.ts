import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';
import {
  acknowledgeNotificationHandler,
  listNotificationsHandler
} from './notification.controller';

export const notificationRouter = Router();

notificationRouter.use('/admin/notifications', authenticate, requireAdmin);

notificationRouter.get('/admin/notifications', listNotificationsHandler);
notificationRouter.post(
  '/admin/notifications/:notificationId/acknowledge',
  acknowledgeNotificationHandler
);
