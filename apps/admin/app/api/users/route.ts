import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@extraction/db';

import { hashPassword } from '../../../lib/password';
import { requireAdminSession } from '../../../lib/auth';

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must contain at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.'),

  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),

  password: z
    .string()
    .min(12, 'Password must contain at least 12 characters.')
    .max(128, 'Password must not exceed 128 characters.'),

  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
});

export async function GET() {
  try {
    await requireAdminSession();

    const users = await prisma.user.findMany({
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
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
      users,
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

    console.error('Failed to fetch users:', error);

    return NextResponse.json(
      {
        error: 'Unable to load users.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const body = await request.json();

    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid user data.',
        },
        { status: 400 },
      );
    }

    const { name, email, password, role } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'A user with this email address already exists.',
        },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        isActive: true,
      },
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

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 },
    );
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

    console.error('Failed to create user:', error);

    return NextResponse.json(
      {
        error: 'Unable to create user.',
      },
      { status: 500 },
    );
  }
}
