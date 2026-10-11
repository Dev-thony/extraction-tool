import { NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { RecordListQuerySchema, type Paginated } from '@extraction/types';
import { requireAdminSession } from '../../../lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const firstLetterRaw = searchParams.get('firstLetter')?.trim().toLocaleUpperCase() ?? '';
    const firstLetter = /^[A-Z]$/.test(firstLetterRaw) ? firstLetterRaw : '';

    const query = RecordListQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: searchParams.get('sortDir') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    });

    const { page, pageSize, sortBy, sortDir, search, status, dateFrom, dateTo } = query;

    const where = {
      ...(status
        ? {
            status,
          }
        : {}),

      ...(firstLetter
        ? { fullName: { startsWith: firstLetter, mode: 'insensitive' as const } }
        : {}),

      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                userName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                phoneNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                pukNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),

      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.record.findMany({
        where,
        orderBy: {
          [sortBy]: sortDir,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.record.count({
        where,
      }),
    ]);

    const response: Paginated<(typeof items)[number]> = {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Records GET error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unable to load records.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession();

    const body = await request.json();

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        {
          error: 'At least one record ID is required.',
        },
        { status: 400 },
      );
    }

    const ids = body.ids.filter(
      (id: unknown): id is string => typeof id === 'string' && id.length > 0,
    );

    if (ids.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid record IDs were supplied.',
        },
        { status: 400 },
      );
    }

    const result = await prisma.record.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error('Records DELETE error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unable to delete records.' }, { status: 500 });
  }
}
