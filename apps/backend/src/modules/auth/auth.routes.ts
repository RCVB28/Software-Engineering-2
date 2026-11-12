import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ActorType, ResidentRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, asyncHandler } from '../../middleware/error';
import { authenticate } from '../../middleware/auth';
import { assert, isEmail, optionalEnum, optionalString, requireString } from '../../middleware/validation';
import { recordAudit } from '../audit/audit.service';
import { verifyGoogleIdToken } from './google';
import { signAccessToken } from './token';

export const authRouter = Router();

const EXPIRES_IN_SECONDS = 3600;

function authResponse(user: {
  id: string;
  kind: 'ADMIN' | 'RESIDENT';
  role: string;
  email: string;
  displayName: string | null;
  barangayId: string | null;
}) {
  const accessToken = signAccessToken({
    sub: user.id,
    kind: user.kind,
    role: user.role,
    barangayId: user.barangayId,
    email: user.email
  });
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: EXPIRES_IN_SECONDS,
    user
  };
}

authRouter.post(
  '/auth/admin/login',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const email = requireString(body.email, 'email').toLowerCase();
    assert(isEmail(email), 'email must be a valid address');
    const password = requireString(body.password, 'password');

    const admin = await prisma.administrator.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');

    await recordAudit(prisma, {
      actorType: ActorType.ADMIN,
      actorId: admin.id,
      action: 'ADMIN_LOGIN',
      entityType: 'Administrator',
      entityId: admin.id
    });

    res.json(
      authResponse({
        id: admin.id,
        kind: 'ADMIN',
        role: admin.role,
        email: admin.email,
        displayName: admin.displayName,
        barangayId: admin.barangayId
      })
    );
  })
);

authRouter.post(
  '/auth/resident/google',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const idToken = requireString(body.idToken, 'idToken');
    const identity = await verifyGoogleIdToken(idToken);

    let resident = await prisma.resident.findFirst({
      where: { OR: [{ googleSubject: identity.subject }, { email: identity.email }] }
    });

    if (!resident) {
      const barangayId = requireString(body.barangayId, 'barangayId');
      const role = optionalEnum(body.role, Object.values(ResidentRole), 'role');
      resident = await prisma.resident.create({
        data: {
          googleSubject: identity.subject,
          email: identity.email,
          displayName: optionalString(body.displayName, 'displayName') ?? identity.name ?? null,
          barangayId,
          role: role ?? ResidentRole.RESIDENT,
          buildingTag: optionalString(body.buildingTag, 'buildingTag')
        }
      });
    } else if (resident.googleSubject !== identity.subject) {
      resident = await prisma.resident.update({
        where: { id: resident.id },
        data: { googleSubject: identity.subject }
      });
    }

    if (!resident.isActive) {
      throw new AppError(403, 'Resident account is inactive', 'FORBIDDEN');
    }

    await recordAudit(prisma, {
      actorType: ActorType.RESIDENT,
      actorId: resident.id,
      action: 'RESIDENT_LOGIN',
      entityType: 'Resident',
      entityId: resident.id
    });

    res.json(
      authResponse({
        id: resident.id,
        kind: 'RESIDENT',
        role: resident.role,
        email: resident.email,
        displayName: resident.displayName,
        barangayId: resident.barangayId
      })
    );
  })
);

authRouter.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const principal = req.user!;
    if (principal.kind === 'ADMIN') {
      const admin = await prisma.administrator.findUnique({ where: { id: principal.id } });
      if (!admin) throw new AppError(404, 'Administrator not found', 'NOT_FOUND');
      res.json({
        id: admin.id,
        kind: 'ADMIN',
        role: admin.role,
        email: admin.email,
        displayName: admin.displayName,
        barangayId: admin.barangayId
      });
      return;
    }
    const resident = await prisma.resident.findUnique({ where: { id: principal.id } });
    if (!resident) throw new AppError(404, 'Resident not found', 'NOT_FOUND');
    res.json({
      id: resident.id,
      kind: 'RESIDENT',
      role: resident.role,
      email: resident.email,
      displayName: resident.displayName,
      barangayId: resident.barangayId
    });
  })
);
