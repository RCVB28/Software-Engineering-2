import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/error';
import { optionalString } from '../../middleware/validation';
import { listAudit } from './audit.service';

export const listAuditHandler = asyncHandler(async (req, res) => {
  const entityType = optionalString(req.query.entityType, 'entityType');
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const entries = await listAudit(prisma, {
    ...(entityType ? { entityType } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {})
  });
  res.json(entries);
});
