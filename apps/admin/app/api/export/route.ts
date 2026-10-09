import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@extraction/db';
import { RecordListQuerySchema, type ExtractionRecord } from '@extraction/types';
import { recordsToCsv, recordsToXlsxBuffer } from '@extraction/utils';

import { requireAdminSession } from '../../../lib/auth';

type ExportFormat = 'xlsx' | 'csv';
type ExportScope = 'selected' | 'filtered' | 'all';

interface ExportRequest {
  format?: ExportFormat;
  scope?: ExportScope;
  ids?: string[];
  filters?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDir?: string;
  };
}

function normalizeDateRange(dateFrom?: Date, dateTo?: Date) {
  let normalizedFrom: Date | undefined;
  let normalizedTo: Date | undefined;

  if (dateFrom) {
    normalizedFrom = new Date(dateFrom);
    normalizedFrom.setHours(0, 0, 0, 0);
  }

  if (dateTo) {
    normalizedTo = new Date(dateTo);
    normalizedTo.setHours(23, 59, 59, 999);
  }

  return {
    normalizedFrom,
    normalizedTo,
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as ExportRequest;

    const format = body.format ?? 'xlsx';
    const scope = body.scope ?? 'all';

    if (!['xlsx', 'csv'].includes(format)) {
      return NextResponse.json({ error: 'Invalid export format.' }, { status: 400 });
    }

    if (!['selected', 'filtered', 'all'].includes(scope)) {
      return NextResponse.json({ error: 'Invalid export scope.' }, { status: 400 });
    }

    if (scope === 'selected') {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return NextResponse.json({ error: 'No records were selected.' }, { status: 400 });
      }
    }

    const filters = body.filters ?? {};

    const parsed = RecordListQuerySchema.safeParse({
      page: 1,
      pageSize: 100,
      sortBy: filters.sortBy ?? 'createdAt',
      sortDir: filters.sortDir ?? 'desc',
      search: filters.search || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid filters.',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { sortBy, sortDir, search, status, dateFrom, dateTo } = parsed.data;

    const { normalizedFrom, normalizedTo } = normalizeDateRange(dateFrom, dateTo);

    const where: any = {};

    if (scope === 'selected') {
      where.id = {
        in: body.ids,
      };
    } else {
      if (search) {
        where.OR = [
          {
            fullName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            userName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            phoneNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            pukNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (status) {
        where.status = status;
      }

      if (normalizedFrom || normalizedTo) {
        where.createdAt = {};

        if (normalizedFrom) {
          where.createdAt.gte = normalizedFrom;
        }

        if (normalizedTo) {
          where.createdAt.lte = normalizedTo;
        }
      }
    }

    const records = await prisma.record.findMany({
      where,
      orderBy: {
        [sortBy]: sortDir,
      },
    });

    const exportRecords = records.map((record): ExtractionRecord => ({
      id: record.id,
      imageUrl: record.imageUrl,
      imageKey: record.imageKey,
      fullName: record.fullName,
      userName: record.userName,
      email: record.email,
      phoneNumber: record.phoneNumber,
      pukNumber: record.pukNumber,
      confidence: record.confidence,
      fieldConfidences:
        record.fieldConfidences && typeof record.fieldConfidences === 'object'
          ? (record.fieldConfidences as ExtractionRecord['fieldConfidences'])
          : null,
      rawOCR: record.rawOCR,
      status: record.status,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    if (exportRecords.length === 0) {
      return NextResponse.json({ error: 'No records matched the export.' }, { status: 404 });
    }

    if (format === 'csv') {
      const csv = recordsToCsv(exportRecords);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="records.csv"',
        },
      });
    }

    const workbook = recordsToXlsxBuffer(exportRecords);

    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="records.xlsx"',
      },
    });
  } catch (error) {
    console.error('Export error:', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to export records.' }, { status: 500 });
  }
}
