import { AlertCategory, PrismaClient, ResidentRole } from '@prisma/client';

export interface TargetInput {
  barangayId?: string | null;
  residentRole?: ResidentRole | null;
}

export interface Recipient {
  residentId: string;
  displayName: string | null;
  barangayId: string;
  role: ResidentRole;
  phoneNumbers: string[];
}

/**
 * A resident matches a single target when every non-null constraint holds (AND semantics). Across
 * multiple targets, matching any target is sufficient (OR semantics).
 */
export function matchesTarget(
  resident: { barangayId: string; role: ResidentRole },
  target: TargetInput
): boolean {
  if (target.barangayId && resident.barangayId !== target.barangayId) return false;
  if (target.residentRole && resident.role !== target.residentRole) return false;
  return true;
}

export async function resolveRecipients(
  prisma: PrismaClient,
  targets: TargetInput[],
  category: AlertCategory
): Promise<Recipient[]> {
  const or = targets.map((target) => ({
    ...(target.barangayId ? { barangayId: target.barangayId } : {}),
    ...(target.residentRole ? { role: target.residentRole } : {})
  }));

  const residents = await prisma.resident.findMany({
    where: {
      isActive: true,
      consent: { granted: true },
      phones: { some: {} },
      ...(or.length > 0 ? { OR: or } : {}),
      NOT: { preferences: { some: { category, optedIn: false } } }
    },
    include: { phones: true }
  });

  return residents.map((resident) => ({
    residentId: resident.id,
    displayName: resident.displayName,
    barangayId: resident.barangayId,
    role: resident.role,
    phoneNumbers: resident.phones.map((phone) => phone.number)
  }));
}
