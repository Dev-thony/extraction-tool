import { NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { UpdateRecordInputSchema } from '@extraction/types';
import { requireAdminSession } from '../../../../lib/auth';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;

    const record = await prisma.record.findUnique({
      where: {
        id,
      },
      include: {
        logs: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        {
          error: 'Record not found.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Record GET error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unable to load record.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireAdminSession();

    const { id } = await context.params;

    const body = await request.json();

    const input = UpdateRecordInputSchema.parse(body);

    const existing = await prisma.record.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Record not found.',
        },
        { status: 404 },
      );
    }

    const record = await prisma.record.update({
      where: {
        id,
      },
      data: input,
    });

    await prisma.processingLog.create({
      data: {
        recordId: id,
        event: 'ADMIN_RECORD_UPDATED',
        level: 'INFO',
        message: `Record updated by ${session.email}.`,
        meta: {
          fields: Object.keys(input),
        },
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('Record PATCH error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unable to update record.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdminSession();

    const { id } = await context.params;

    const existing = await prisma.record.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Record not found.',
        },
        { status: 404 },
      );
    }

    await prisma.record.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: id,
      deletedBy: session.email,
    });
  } catch (error) {
    console.error('Record DELETE error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unable to delete record.' }, { status: 500 });
  }
}
