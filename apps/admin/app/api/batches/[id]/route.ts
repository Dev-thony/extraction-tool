import { NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { requireAdminSession } from '../../../../lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;

    const batch = await prisma.extractionBatch.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }

    const recordIds = [...new Set(batch.items.flatMap((item) => item.recordIds))];

    const records = recordIds.length
      ? await prisma.record.findMany({
          where: { id: { in: recordIds } },
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
          },
        })
      : [];

    return NextResponse.json({ batch, records });
  } catch (error) {
    console.error('Get batch error:', error);

    return NextResponse.json({ error: 'Unable to load batch details.' }, { status: 500 });
  }
}
