import type { ActorType, Prisma, PrismaClient } from '@prisma/client';

export interface AuditInput {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(prisma: PrismaClient, input: AuditInput): Promise<void> {
  await prisma.auditEntry.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}

export interface AuditFilters {
  entityType?: string;
  from?: Date;
  to?: Date;
}

export async function listAudit(prisma: PrismaClient, filters: AuditFilters) {
  const where: Prisma.AuditEntryWhereInput = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  return prisma.auditEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
}
