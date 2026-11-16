import { AlertCategory, PrismaClient, ResidentRole } from '@prisma/client';
import { matchesTarget, resolveRecipients } from '../../src/modules/alerts/recipient.service';

describe('recipient targeting', () => {
  it('matches when all target constraints hold', () => {
    expect(
      matchesTarget(
        { barangayId: 'b1', role: ResidentRole.STUDENT },
        { barangayId: 'b1', residentRole: ResidentRole.STUDENT }
      )
    ).toBe(true);
  });

  it('rejects barangay and role mismatches', () => {
    expect(matchesTarget({ barangayId: 'b2', role: ResidentRole.RESIDENT }, { barangayId: 'b1' })).toBe(false);
    expect(
      matchesTarget(
        { barangayId: 'b1', role: ResidentRole.TEACHER },
        { residentRole: ResidentRole.STUDENT }
      )
    ).toBe(false);
  });

  it('treats an empty target as matching everyone', () => {
    expect(matchesTarget({ barangayId: 'b1', role: ResidentRole.OTHER }, {})).toBe(true);
  });

  it('builds an eligibility query that excludes opted-out categories', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'r1',
        displayName: 'Resident One',
        barangayId: 'b1',
        role: ResidentRole.RESIDENT,
        phones: [{ number: '+639170000001' }]
      }
    ]);
    const prisma = { resident: { findMany } } as unknown as PrismaClient;

    const recipients = await resolveRecipients(prisma, [{ barangayId: 'b1' }], AlertCategory.FIRE);

    expect(recipients).toEqual([
      {
        residentId: 'r1',
        displayName: 'Resident One',
        barangayId: 'b1',
        role: ResidentRole.RESIDENT,
        phoneNumbers: ['+639170000001']
      }
    ]);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.consent).toEqual({ granted: true });
    expect(where.phones).toEqual({ some: {} });
    expect(where.NOT).toEqual({
      preferences: { some: { category: AlertCategory.FIRE, optedIn: false } }
    });
  });
});
