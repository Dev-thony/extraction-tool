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

    if (batch.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Wait for the current processing run to finish.' },
        { status: 409 },
      );
    }

    const result = await prisma.extractionBatchItem.updateMany({
      where: {
        batchId: id,
        status: 'FAILED',
      },
      data: {
        status: 'QUEUED',
        error: null,
        attempts: 0,
        startedAt: null,
        completedAt: null,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'This batch has no failed items to retry.' },
        { status: 400 },
      );
    }

    await prisma.extractionBatch.update({
      where: { id },
      data: {
        status: 'QUEUED',
        failedItems: 0,
        completedAt: null,
      },
    });

    return NextResponse.json({
      message: `${result.count} failed item(s) queued for retry.`,
      retriedCount: result.count,
    });
  } catch (error) {
    console.error('Retry batch error:', error);

    return NextResponse.json({ error: 'Unable to retry failed items.' }, { status: 500 });
  }
}
