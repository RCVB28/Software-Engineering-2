import bcrypt from 'bcryptjs';
import { AdminRole, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { isEmail } from '../../middleware/validation';
import { recordAudit } from '../audit/audit.service';

export interface AdminCreateInput {
  email: string;
  password: string;
  role: AdminRole;
  displayName?: string | null;
  barangayId?: string | null;
}

export interface AdminUpdateInput {
  password?: string;
  role?: AdminRole;
  displayName?: string | null;
  barangayId?: string | null;
  isActive?: boolean;
}

type AdminRecord = Prisma.AdministratorGetPayload<Record<string, never>>;

function sanitize(admin: AdminRecord) {
  const rest: Record<string, unknown> = { ...admin };
  delete rest.passwordHash;
  return rest;
}

function validateAssignment(role: AdminRole, barangayId: string | null | undefined): void {
  if (role === AdminRole.LOW_LEVEL && !barangayId) {
    throw new AppError(400, 'LOW_LEVEL administrators require a barangayId', 'VALIDATION_ERROR');
  }
}

export async function listAdmins(prisma: PrismaClient) {
  const admins = await prisma.administrator.findMany({ orderBy: { createdAt: 'asc' } });
  return admins.map(sanitize);
}

export async function createAdmin(
  prisma: PrismaClient,
  actorId: string,
  input: AdminCreateInput
) {
  const email = input.email.toLowerCase();
  if (!isEmail(email)) throw new AppError(400, 'email must be a valid address', 'VALIDATION_ERROR');
  if (input.password.length < 8) {
    throw new AppError(400, 'password must be at least 8 characters', 'VALIDATION_ERROR');
  }
  validateAssignment(input.role, input.barangayId);

  const existing = await prisma.administrator.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'An administrator with this email exists', 'DUPLICATE');

  const admin = await prisma.administrator.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
      displayName: input.displayName ?? null,
      barangayId: input.barangayId ?? null
    }
  });
  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId,
    action: 'ADMIN_CREATED',
    entityType: 'Administrator',
    entityId: admin.id,
    metadata: { role: admin.role }
  });
  return sanitize(admin);
}

export async function updateAdmin(
  prisma: PrismaClient,
  actorId: string,
  adminId: string,
  input: AdminUpdateInput
) {
  const existing = await prisma.administrator.findUnique({ where: { id: adminId } });
  if (!existing) throw new AppError(404, 'Administrator not found', 'NOT_FOUND');

  const role = input.role ?? existing.role;
  const barangayId = input.barangayId !== undefined ? input.barangayId : existing.barangayId;
  validateAssignment(role, barangayId);

  if (input.password !== undefined && input.password.length < 8) {
    throw new AppError(400, 'password must be at least 8 characters', 'VALIDATION_ERROR');
  }

  const admin = await prisma.administrator.update({
    where: { id: adminId },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.barangayId !== undefined ? { barangayId: input.barangayId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await bcrypt.hash(input.password, 10) }
        : {})
    }
  });
  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId,
    action: 'ADMIN_UPDATED',
    entityType: 'Administrator',
    entityId: admin.id,
    metadata: { role: admin.role, isActive: admin.isActive }
  });
  return sanitize(admin);
}
