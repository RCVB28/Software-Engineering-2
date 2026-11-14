import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  AdminRole,
  AlertCategory,
  Consent,
  Locality,
  PrismaClient,
  Resident,
  ResidentRole
} from '@prisma/client';
import { signAccessToken } from '../../src/modules/auth/token';

export const prisma = new PrismaClient();

export const DESCRIBE_DB = process.env.RUN_DB_TESTS === '1';
export const describeDb = DESCRIBE_DB ? describe : describe.skip;

export const ADMIN_PASSWORD = 'Password123!';

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function resetDatabase(): Promise<void> {
  await prisma.failureNotification.deleteMany();
  await prisma.auditRetentionRun.deleteMany();
  await prisma.reportStatusHistory.deleteMany();
  await prisma.deliveryRecord.deleteMany();
  await prisma.alertTarget.deleteMany();
  await prisma.emergencyReport.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.alertPreference.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.phoneNumber.deleteMany();
  await prisma.auditEntry.deleteMany();
  await prisma.administrator.deleteMany();
  await prisma.resident.deleteMany();
  await prisma.barangay.deleteMany();
  await prisma.locality.deleteMany();
}

export interface Fixture {
  locality: Locality;
  barangays: { id: string; name: string }[];
}

export async function createLocality(barangayNames = ['Barangay Uno', 'Barangay Dos']): Promise<Fixture> {
  const locality = await prisma.locality.create({ data: { name: `Test City ${randomUUID()}` } });
  const barangays = [];
  for (const name of barangayNames) {
    barangays.push(
      await prisma.barangay.create({ data: { localityId: locality.id, name } })
    );
  }
  return { locality, barangays };
}

export async function createAdmin(options: {
  role: AdminRole;
  barangayId?: string | null;
  email?: string;
}): Promise<{ admin: { id: string; email: string; role: AdminRole; barangayId: string | null }; token: string }> {
  const email = options.email ?? `${options.role.toLowerCase()}-${randomUUID()}@example.com`;
  const admin = await prisma.administrator.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 8),
      role: options.role,
      barangayId: options.barangayId ?? null,
      displayName: options.role
    }
  });
  const token = signAccessToken({
    sub: admin.id,
    kind: 'ADMIN',
    role: admin.role,
    barangayId: admin.barangayId,
    email: admin.email
  });
  return {
    admin: { id: admin.id, email: admin.email, role: admin.role, barangayId: admin.barangayId },
    token
  };
}

export async function createResident(options: {
  barangayId: string;
  role?: ResidentRole;
  email?: string;
  phones?: string[];
  consent?: boolean;
  optedOut?: AlertCategory[];
}): Promise<{ resident: Resident; consent: Consent | null; token: string }> {
  const email = options.email ?? `resident-${randomUUID()}@example.com`;
  const resident = await prisma.resident.create({
    data: {
      googleSubject: `google-${randomUUID()}`,
      email,
      displayName: 'Test Resident',
      role: options.role ?? ResidentRole.RESIDENT,
      barangayId: options.barangayId,
      phones: {
        create: (options.phones ?? ['+639170000001']).map((number, index) => ({
          number,
          isPrimary: index === 0,
          isVerified: true
        }))
      },
      ...(options.consent === false
        ? {}
        : { consent: { create: { granted: true, policyVersion: 'v1' } } }),
      ...(options.optedOut?.length
        ? {
            preferences: {
              create: options.optedOut.map((category) => ({ category, optedIn: false }))
            }
          }
        : {})
    }
  });
  const consent = await prisma.consent.findUnique({ where: { residentId: resident.id } });
  const token = signAccessToken({
    sub: resident.id,
    kind: 'RESIDENT',
    role: resident.role,
    barangayId: resident.barangayId,
    email: resident.email
  });
  return { resident, consent, token };
}
