import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/error';
import { parseBoolean, parsePage, parsePageSize } from '../../middleware/query';
import {
  acknowledgeNotification,
  listFailureNotifications
} from './notification.service';

export const listNotificationsHandler = asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page);
  const pageSize = parsePageSize(req.query.pageSize);
  const unreadOnly = parseBoolean(req.query.unreadOnly, 'unreadOnly');
  res.json(
    await listFailureNotifications(prisma, req.user!.id, { page, pageSize, unreadOnly })
  );
});

export const acknowledgeNotificationHandler = asyncHandler(async (req, res) => {
  res.json(await acknowledgeNotification(prisma, req.user!.id, req.params.notificationId));
});
