import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@extraction/db';

import { hashPassword } from '../../../../lib/password';
import { requireAdminSession } from '../../../../lib/auth';

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must contain at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.')
    .optional(),

  email: z.string().trim().toLowerCase().email('Enter a valid email address.').optional(),

  role: z.enum(['ADMIN', 'STAFF']).optional(),

  isActive: z.boolean().optional(),

  password: z
    .string()
    .min(12, 'Password must contain at least 12 characters.')
    .max(128, 'Password must not exceed 128 characters.')
    .optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getUserId(context: RouteContext) {
  const params = await context.params;

  return params.id;
}

async function ensureActiveAdminRemains(
  userId: string,
  nextRole?: 'ADMIN' | 'STAFF',
  nextIsActive?: boolean,
) {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
      isActive: true,
    },
  });

  if (!currentUser) {
    return {
      error: 'User not found.',
      status: 404,
    };
  }

  const willBeActiveAdmin =
    (nextRole ?? currentUser.role) === 'ADMIN' && (nextIsActive ?? currentUser.isActive);

  /*
   * Only perform the count when this user is currently an
   * active administrator and the requested change could remove
   * that status.
   */
  if (currentUser.role === 'ADMIN' && currentUser.isActive && !willBeActiveAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
    });

    if (activeAdminCount <= 1) {
      return {
        error: 'The last active administrator cannot be deactivated or demoted.',
        status: 400,
      };
    }
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireAdminSession();

    const userId = await getUserId(context);

    const body = await request.json();

    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid user data.',
        },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          error: 'User not found.',
        },
        { status: 404 },
      );
    }

    /*
     * An administrator cannot deactivate or demote their own
     * account through this endpoint.
     *
     * This prevents an accidental lockout.
     */
    if (
      existingUser.id === session.userId &&
      (parsed.data.isActive === false || parsed.data.role === 'STAFF')
    ) {
      return NextResponse.json(
        {
          error: 'You cannot deactivate or demote your own administrator account.',
        },
        { status: 400 },
      );
    }

    const adminCheck = await ensureActiveAdminRemains(
      userId,
      parsed.data.role,
      parsed.data.isActive,
    );

    if (adminCheck) {
      return NextResponse.json(
        {
          error: adminCheck.error,
        },
        { status: adminCheck.status },
      );
    }

    if (parsed.data.email && parsed.data.email !== existingUser.email) {
      const emailOwner = await prisma.user.findUnique({
        where: {
          email: parsed.data.email,
        },
        select: {
          id: true,
        },
      });

      if (emailOwner && emailOwner.id !== userId) {
        return NextResponse.json(
          {
            error: 'A user with this email address already exists.',
          },
          { status: 409 },
        );
      }
    }

    const updateData: {
      name?: string;
      email?: string;
      role?: 'ADMIN' | 'STAFF';
      isActive?: boolean;
      passwordHash?: string;
    } = {};

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.email !== undefined) {
      updateData.email = parsed.data.email;
    }

    if (parsed.data.role !== undefined) {
      updateData.role = parsed.data.role;
    }

    if (parsed.data.isActive !== undefined) {
      updateData.isActive = parsed.data.isActive;
    }

    if (parsed.data.password !== undefined) {
      updateData.passwordHash = await hashPassword(parsed.data.password);
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        {
          error: 'Administrator access required.',
        },
        { status: 403 },
      );
    }

    console.error('Failed to update user:', error);

    return NextResponse.json(
      {
        error: 'Unable to update user.',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdminSession();

    const userId = await getUserId(context);

    if (userId === session.userId) {
      return NextResponse.json(
        {
          error: 'You cannot delete your own administrator account.',
        },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          error: 'User not found.',
        },
        { status: 404 },
      );
    }

    if (existingUser.role === 'ADMIN' && existingUser.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        return NextResponse.json(
          {
            error: 'The last active administrator cannot be deleted.',
          },
          { status: 400 },
        );
      }
    }

    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        {
          error: 'Administrator access required.',
        },
        { status: 403 },
      );
    }

    console.error('Failed to delete user:', error);

    return NextResponse.json(
      {
        error: 'Unable to delete user.',
      },
      { status: 500 },
    );
  }
}
