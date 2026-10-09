import { prisma } from '@extraction/db';
import { getEnv } from '@extraction/core';

import { hashPassword } from '../apps/admin/lib/password';

async function main() {
  const env = getEnv();

  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;

  if (!email) {
    throw new Error('ADMIN_EMAIL is not configured.');
  }

  if (!password) {
    throw new Error('ADMIN_PASSWORD is not configured.');
  }

  console.log(`Bootstrapping administrator: ${email}`);

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  const passwordHash = await hashPassword(password);

  if (existingUser) {
    await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        name: existingUser.name || 'Administrator',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('Existing user updated as administrator.');
  } else {
    await prisma.user.create({
      data: {
        name: 'Administrator',
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('Database administrator created successfully.');
  }
}

main()
  .catch((error) => {
    console.error('Failed to bootstrap administrator:', error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
