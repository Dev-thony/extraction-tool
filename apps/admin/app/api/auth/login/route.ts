import { NextResponse } from 'next/server';

import { createSessionToken, getEnv } from '@extraction/core';
import { prisma } from '@extraction/db';

import { hashPassword, verifyPassword } from '../../../../lib/password';
import { createAuthProvider, SESSION_COOKIE } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'Email and password are required.',
        },
        { status: 400 },
      );
    }

    /*
     * First try the database-backed account.
     *
     * This is now the primary authentication mechanism.
     */
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user) {
      const dbUser = user as typeof user & {
        isActive?: boolean;
        passwordHash?: string | null;
      };

      if (!dbUser.isActive) {
        return NextResponse.json(
          {
            error: 'This account has been deactivated.',
          },
          { status: 403 },
        );
      }

      /*
       * A database account must have a password hash before it
       * can authenticate through the new account system.
       */
      if (!dbUser.passwordHash) {
        return NextResponse.json(
          {
            error: 'This account has not been configured for password login.',
          },
          { status: 401 },
        );
      }

      const validPassword = await verifyPassword(password, dbUser.passwordHash);

      if (!validPassword) {
        return NextResponse.json(
          {
            error: 'Invalid administrator credentials.',
          },
          { status: 401 },
        );
      }

      /*
       * Only ADMIN users can currently enter the admin portal.
       *
       * STAFF accounts are intentionally supported in the database
       * but do not yet receive admin-portal access.
       */
      if (dbUser.role !== 'ADMIN') {
        return NextResponse.json(
          {
            error: 'You do not have permission to access the admin portal.',
          },
          { status: 403 },
        );
      }

      const session = {
        userId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        isActive: dbUser.isActive,
      };

      const env = getEnv();

      const token = await createSessionToken(session, env.AUTH_SESSION_SECRET);

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      });

      const response = NextResponse.json({
        success: true,
        user: session,
      });

      response.cookies.set({
        name: SESSION_COOKIE,
        value: token,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 8,
      });

      return response;
    }

    /*
     * Temporary compatibility fallback.
     *
     * This allows the existing environment-based admin account
     * to continue working until we create the first database
     * administrator.
     */
    const provider = createAuthProvider();

    const session = await provider.authenticate({
      email,
      password,
    });

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: 'Invalid administrator credentials.',
        },
        { status: 401 },
      );
    }

    const env = getEnv();

    const token = await createSessionToken(session, env.AUTH_SESSION_SECRET);

    const response = NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error('Admin login failed:', error);

    return NextResponse.json(
      {
        error: 'Unable to sign in.',
      },
      { status: 500 },
    );
  }
}
