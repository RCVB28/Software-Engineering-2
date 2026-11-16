import { PrismaClient, AdminRole, ResidentRole, AlertCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const locality = await prisma.locality.upsert({
    where: { name: 'San Isidro' },
    update: {},
    create: { name: 'San Isidro' }
  });

  const barangayNames = ['Poblacion', 'Barangay Uno', 'Barangay Dos'];
  const barangays = [];
  for (const name of barangayNames) {
    const b = await prisma.barangay.upsert({
      where: { localityId_name: { localityId: locality.id, name } },
      update: {},
      create: { localityId: locality.id, name }
    });
    barangays.push(b);
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const admins = [
    { email: 'superadmin@example.com', role: AdminRole.SUPERADMIN, barangayId: null },
    { email: 'mayor@example.com', role: AdminRole.HIGH_LEVEL, barangayId: null },
    { email: 'captain@example.com', role: AdminRole.LOW_LEVEL, barangayId: barangays[0].id }
  ];
  for (const a of admins) {
    await prisma.administrator.upsert({
      where: { email: a.email },
      update: { role: a.role, barangayId: a.barangayId },
      create: { email: a.email, passwordHash, role: a.role, barangayId: a.barangayId, displayName: a.email.split('@')[0] }
    });
  }

  const residents = [
    { email: 'resident1@example.com', googleSubject: 'demo-1', role: ResidentRole.RESIDENT, barangayId: barangays[0].id },
    { email: 'resident2@example.com', googleSubject: 'demo-2', role: ResidentRole.STUDENT, barangayId: barangays[1].id },
    { email: 'resident3@example.com', googleSubject: 'demo-3', role: ResidentRole.TEACHER, barangayId: barangays[2].id }
  ];
  for (const r of residents) {
    const resident = await prisma.resident.upsert({
      where: { email: r.email },
      update: { role: r.role, barangayId: r.barangayId },
      create: {
        email: r.email,
        googleSubject: r.googleSubject,
        role: r.role,
        barangayId: r.barangayId,
        displayName: r.email.split('@')[0]
      }
    });
    await prisma.phoneNumber.upsert({
      where: { residentId_number: { residentId: resident.id, number: '+639170000000' } },
      update: {},
      create: { residentId: resident.id, number: '+639170000000', isPrimary: true }
    });
    await prisma.consent.upsert({
      where: { residentId: resident.id },
      update: { granted: true },
      create: { residentId: resident.id, granted: true, policyVersion: 'v1' }
    });
    for (const category of Object.values(AlertCategory)) {
      await prisma.alertPreference.upsert({
        where: { residentId_category: { residentId: resident.id, category } },
        update: {},
        create: { residentId: resident.id, category, optedIn: true }
      });
    }
  }

  console.log('Seed complete:', { locality: locality.name, barangays: barangays.length, admins: admins.length, residents: residents.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
