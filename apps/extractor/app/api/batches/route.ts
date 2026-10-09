import { NextResponse } from 'next/server';

import { getEnv, getStorageProvider } from '@extraction/core';

import { prisma } from '@extraction/db';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_ITEMS = 200;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  const storedKeys: string[] = [];

  try {
    const formData = await request.formData();

    const files = formData.getAll('files').filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No image files were provided.',
        },
        { status: 400 },
      );
    }

    if (files.length > MAX_BATCH_ITEMS) {
      return NextResponse.json(
        {
          success: false,
          error: `A batch can contain a maximum of ${MAX_BATCH_ITEMS} images.`,
        },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported image type: ${file.name}. Use JPG, PNG, or WEBP.`,
          },
          { status: 400 },
        );
      }

      if (file.size <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: `The uploaded image "${file.name}" is empty.`,
          },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `"${file.name}" is larger than 10 MB.`,
          },
          { status: 400 },
        );
      }
    }

    const env = getEnv();
    const storage = getStorageProvider(env);

    /*
     * Store every image first.
     */
    const storedFiles: Array<{
      file: File;
      stored: Awaited<ReturnType<typeof storage.put>>;
    }> = [];

    for (const file of files) {
      const imageBuffer = Buffer.from(await file.arrayBuffer());

      const stored = await storage.put({
        body: imageBuffer,
        contentType: file.type,
        filename: file.name,
      });

      storedKeys.push(stored.key);

      storedFiles.push({
        file,
        stored,
      });
    }

    /*
     * Create the batch and all queued items atomically.
     */
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await (tx as any).extractionBatch.create({
        data: {
          name: `Batch ${new Date().toLocaleString()}`,
          source: 'LOCAL',
          status: 'QUEUED',

          totalItems: storedFiles.length,
          queuedItems: storedFiles.length,
          processingItems: 0,
          completedItems: 0,
          failedItems: 0,
          reviewItems: 0,
        },
      });

      await (tx as any).extractionBatchItem.createMany({
        data: storedFiles.map(({ file, stored }) => ({
          batchId: createdBatch.id,

          status: 'QUEUED',

          filename: file.name,
          mimeType: file.type,

          source: 'LOCAL',

          sourceFileId: null,
          sourceKey: stored.key,

          recordIds: [],

          attempts: 0,
        })),
      });

      await (tx as any).batchProcessingLog.create({
        data: {
          batchId: createdBatch.id,

          event: 'batch.created',

          level: 'INFO',

          message: `Batch created with ${storedFiles.length} queued item(s).`,

          meta: {
            source: 'LOCAL',
            totalItems: storedFiles.length,
          },
        },
      });

      return createdBatch;
    });

    /*
     * Return the newly-created batch together with its items.
     */
    const items = (await prisma.$queryRaw<Array<{
      id: string;
      batchId: string;
      status: string;
      filename: string | null;
      mimeType: string | null;
      source: string;
      sourceFileId: string | null;
      sourceKey: string | null;
      recordIds: string[];
      attempts: number;
      createdAt: Date;
      updatedAt: Date;
    }>>`
      SELECT *
      FROM "ExtractionBatchItem"
      WHERE "batchId" = ${batch.id}
      ORDER BY "createdAt" ASC
    `) as Array<{
      id: string;
      batchId: string;
      status: string;
      filename: string | null;
      mimeType: string | null;
      source: string;
      sourceFileId: string | null;
      sourceKey: string | null;
      recordIds: string[];
      attempts: number;
      createdAt: Date;
      updatedAt: Date;
    }>;

    return NextResponse.json(
      {
        success: true,

        batch: {
          id: batch.id,
          name: batch.name,
          source: batch.source,
          status: batch.status,

          totalItems: batch.totalItems,
          queuedItems: batch.queuedItems,
          processingItems: batch.processingItems,
          completedItems: batch.completedItems,
          failedItems: batch.failedItems,
          reviewItems: batch.reviewItems,

          createdAt: batch.createdAt,
        },

        items,
      },
      { status: 201 },
    );
  } catch (error) {
    /*
     * If storage succeeded but database creation failed,
     * remove every image we already stored.
     */
    if (storedKeys.length > 0) {
      try {
        const env = getEnv();
        const storage = getStorageProvider(env);

        for (const key of storedKeys) {
          try {
            await storage.remove(key);
          } catch {
            // Continue cleaning up the remaining files.
          }
        }
      } catch {
        // Do not hide the original error.
      }
    }

    const message = errorMessage(error);

    console.error('Batch creation failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
