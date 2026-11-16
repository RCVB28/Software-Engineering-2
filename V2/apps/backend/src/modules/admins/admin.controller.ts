import { AdminRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/error';
import { assert, optionalString, parseEnum, requireString } from '../../middleware/validation';
import { createAdmin, listAdmins, updateAdmin } from './admin.service';

export const listAdminsHandler = asyncHandler(async (_req, res) => {
  res.json(await listAdmins(prisma));
});

export const createAdminHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const admin = await createAdmin(prisma, req.user!.id, {
    email: requireString(body.email, 'email'),
    password: requireString(body.password, 'password'),
    role: parseEnum(body.role, Object.values(AdminRole), 'role'),
    displayName: optionalString(body.displayName, 'displayName', 120),
    barangayId: optionalString(body.barangayId, 'barangayId')
  });
  res.status(201).json(admin);
});

export const updateAdminHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  if (body.isActive !== undefined) {
    assert(typeof body.isActive === 'boolean', 'isActive must be a boolean');
  }
  const admin = await updateAdmin(prisma, req.user!.id, req.params.adminId, {
    ...(body.role !== undefined
      ? { role: parseEnum(body.role, Object.values(AdminRole), 'role') }
      : {}),
    ...(body.displayName !== undefined
      ? { displayName: optionalString(body.displayName, 'displayName', 120) }
      : {}),
    ...(body.barangayId !== undefined
      ? { barangayId: optionalString(body.barangayId, 'barangayId') }
      : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive as boolean } : {}),
    ...(body.password !== undefined ? { password: requireString(body.password, 'password') } : {})
  });
  res.json(admin);
});
