import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { requireAdminSession } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize')) || 20));
    const search = params.get('search')?.trim();
    const status = params.get('status');

    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(status ? { status: status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.extractionBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.extractionBatch.count({ where }),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('List batches error:', error);

    return NextResponse.json({ error: 'Unable to load batches.' }, { status: 500 });
  }
}
