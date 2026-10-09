import { NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { requireAdminSession } from '../../../../../lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;

    const batch = await prisma.extractionBatch.findUnique({
      where: { id },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }

    const activeItems = await prisma.extractionBatchItem.count({
      where: {
        batchId: id,
        status: 'PROCESSING',
      },
    });

    if (activeItems > 0) {
      return NextResponse.json(
        {
          error:
            'An item is currently processing. Wait for it to finish before cancelling the remaining queue.',
        },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.extractionBatchItem.updateMany({
        where: {
          batchId: id,
          status: 'QUEUED',
        },
        data: { status: 'CANCELLED' },
      }),
      prisma.extractionBatch.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Queued items cancelled.',
    });
  } catch (error) {
    console.error('Cancel batch error:', error);

    return NextResponse.json({ error: 'Unable to cancel batch.' }, { status: 500 });
  }
}
