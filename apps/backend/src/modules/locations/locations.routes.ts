import { Router } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/error';

export const locationRouter = Router();

locationRouter.get(
  '/barangays',
  asyncHandler(async (_req, res) => {
    const barangays = await prisma.barangay.findMany({ orderBy: { name: 'asc' } });
    res.json(barangays.map((barangay) => ({ id: barangay.id, name: barangay.name })));
  })
);
