import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient instance shared across the app. In development, Next.js
 * hot-reloads modules repeatedly; without caching on `globalThis` each reload
 * would open a new connection pool and exhaust the database.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export the generated client (enums, `Prisma` namespace, model types) so
// consumers depend only on `@extraction/db`.
export * from '@prisma/client';
