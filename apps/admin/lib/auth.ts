import { cookies } from 'next/headers';

import { DevAuthProvider, getEnv, verifySessionToken, type Session } from '@extraction/core';

import { prisma } from '@extraction/db';

export const SESSION_COOKIE = 'admin_session';

export async function getAdminSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const env = getEnv();

  try {
    const session = await verifySessionToken(token, env.AUTH_SESSION_SECRET);

    if (!session) {
      return null;
    }

    /*
     * If this session belongs to a database user, make sure the
     * account still exists and is active.
     *
     * This means an administrator can deactivate an account and
     * that account will immediately lose access on its next request.
     */
    if (session.email) {
      const user = await prisma.user.findUnique({
        where: {
          email: session.email,
        },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

      if (user) {
        if (!user.isActive) {
          return null;
        }

        /*
         * Keep the database role authoritative.
         *
         * This prevents an old session from retaining ADMIN
         * privileges after the user's role has been changed.
         */
        return {
          ...session,
          role: user.role,
        };
      }
    }

    return session;
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<Session> {
  const session = await getAdminSession();

  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  if (session.role !== 'ADMIN') {
    throw new Error('FORBIDDEN');
  }

  return session;
}

/**
 * Requires an authenticated user regardless of whether they are
 * an ADMIN or STAFF user.
 */
export async function requireAuthenticatedSession(): Promise<Session> {
  const session = await getAdminSession();

  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

/**
 * Database-backed account lookup.
 *
 * This is intentionally kept separate from getAdminSession() so
 * authentication/session concerns remain easy to reason about.
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim(),
    },
  });
}

/**
 * Development authentication provider.
 *
 * This remains available while the application transitions from
 * the original environment-based admin account to database-backed
 * accounts.
 */
export function createAuthProvider() {
  const env = getEnv();

  if (env.AUTH_PROVIDER === 'dev') {
    return new DevAuthProvider({
      adminEmail: env.ADMIN_EMAIL,
      adminPassword: env.ADMIN_PASSWORD,
    });
  }

  throw new Error(
    `Authentication provider "${env.AUTH_PROVIDER}" is not implemented in the admin application yet.`,
  );
}
