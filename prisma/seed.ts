import { PrismaClient, Role } from '@prisma/client';

/**
 * Seeds the initial admin user. Idempotent — safe to run repeatedly.
 * Requires DATABASE_URL and an applied schema (`npm run db:migrate`).
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const name = 'Administrator';

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN },
    create: { name, email, role: Role.ADMIN },
  });

  console.log(`Seeded admin user: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
