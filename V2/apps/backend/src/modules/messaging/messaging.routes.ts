import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin, requireRoles } from '../../middleware/rbac';
import { getMessagingStatusHandler, sendTestMessageHandler } from './messaging.controller';

export const messagingRouter = Router();

messagingRouter.use('/admin/messaging', authenticate, requireAdmin);

// Any administrator may inspect the provider configuration.
messagingRouter.get('/admin/messaging/status', getMessagingStatusHandler);

// Only a superadmin may trigger a real (potentially billable) test message.
messagingRouter.post('/admin/messaging/test', requireRoles('SUPERADMIN'), sendTestMessageHandler);
