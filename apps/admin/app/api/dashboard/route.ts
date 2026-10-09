import { NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { requireAdminSession } from '../../../lib/auth';

export async function GET() {
  try {
    await requireAdminSession();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalRecords, recordsToday, pendingReview, processed, failed, confidenceAggregate] =
      await Promise.all([
        prisma.record.count(),

        prisma.record.count({
          where: {
            createdAt: {
              gte: startOfToday,
            },
          },
        }),

        prisma.record.count({
          where: {
            status: 'NEEDS_REVIEW',
          },
        }),

        prisma.record.count({
          where: {
            status: 'PROCESSED',
          },
        }),

        prisma.record.count({
          where: {
            status: 'FAILED',
          },
        }),

        prisma.record.aggregate({
          _avg: {
            confidence: true,
          },
        }),
      ]);

    const averageConfidence = confidenceAggregate._avg.confidence ?? null;

    return NextResponse.json({
      totalRecords,
      recordsToday,
      pendingReview,
      processed,
      failed,
      averageConfidence,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unable to load dashboard statistics.' }, { status: 500 });
  }
}
