import { ReportStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/error';
import { parseEnum } from '../../middleware/validation';
import {
  escalateReport,
  getReport,
  listReports,
  submitReport,
  updateReportStatus
} from './report.service';
import { parseReportInput } from './report.validation';

export const submitReportHandler = asyncHandler(async (req, res) => {
  const resident = await prisma.resident.findUnique({ where: { id: req.user!.id } });
  if (!resident) {
    res.status(401).json({ message: 'Resident not found', code: 'UNAUTHORIZED' });
    return;
  }
  const input = parseReportInput(req.body ?? {});
  res.status(201).json(await submitReport(prisma, resident, input));
});

export const listReportsHandler = asyncHandler(async (req, res) => {
  const status =
    req.query.status === undefined
      ? undefined
      : parseEnum(req.query.status, Object.values(ReportStatus), 'status');
  res.json(await listReports(prisma, req.user!, status));
});

export const getReportHandler = asyncHandler(async (req, res) => {
  res.json(await getReport(prisma, req.user!, req.params.reportId));
});

export const updateReportStatusHandler = asyncHandler(async (req, res) => {
  const status = parseEnum(req.body?.status, Object.values(ReportStatus), 'status');
  res.json(await updateReportStatus(prisma, req.user!, req.params.reportId, status));
});

export const escalateReportHandler = asyncHandler(async (req, res) => {
  res
    .status(201)
    .json(await escalateReport(prisma, req.user!, req.params.reportId, req.body ?? {}));
});
