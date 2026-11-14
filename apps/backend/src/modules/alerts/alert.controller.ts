import { AlertCategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/error';
import { parseEnum, requireString } from '../../middleware/validation';
import { listAlertHistory, parseAlertHistoryQuery } from './alert.history';
import {
  confirmAlert,
  createDraft,
  getAlert,
  listAlerts,
  listDeliveries,
  parseTargets,
  previewRecipients,
  updateDraft
} from './alert.service';

export const listAlertsHandler = asyncHandler(async (req, res) => {
  res.json(await listAlerts(prisma, req.user!));
});

export const createAlertHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const content = requireString(body.content, 'content', 480);
  const category = parseEnum(body.category, Object.values(AlertCategory), 'category');
  const targets = parseTargets(body.targets);
  res.status(201).json(await createDraft(prisma, req.user!, { content, category, targets }));
});

export const getAlertHandler = asyncHandler(async (req, res) => {
  res.json(await getAlert(prisma, req.user!, req.params.alertId));
});

export const listAlertHistoryHandler = asyncHandler(async (req, res) => {
  const filters = parseAlertHistoryQuery(
    req.query as Record<string, unknown>,
    req.user!
  );
  res.json(await listAlertHistory(prisma, req.user!, filters));
});

export const updateAlertHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const input: {
    content?: string;
    category?: AlertCategory;
    targets?: ReturnType<typeof parseTargets>;
  } = {};
  if (body.content !== undefined) input.content = requireString(body.content, 'content', 480);
  if (body.category !== undefined) {
    input.category = parseEnum(body.category, Object.values(AlertCategory), 'category');
  }
  if (body.targets !== undefined) input.targets = parseTargets(body.targets);
  res.json(await updateDraft(prisma, req.user!, req.params.alertId, input));
});

export const previewRecipientsHandler = asyncHandler(async (req, res) => {
  res.json(await previewRecipients(prisma, req.user!, req.params.alertId));
});

export const confirmAlertHandler = asyncHandler(async (req, res) => {
  res.json(await confirmAlert(prisma, req.user!, req.params.alertId));
});

export const listDeliveriesHandler = asyncHandler(async (req, res) => {
  res.json(await listDeliveries(prisma, req.user!, req.params.alertId));
});
