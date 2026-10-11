import { NextResponse } from 'next/server';

import { getEnv, getOcrProvider, getStorageProvider, runExtraction } from '@extraction/core';

import { prisma } from '@extraction/db';

const db = prisma as any;

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function downloadGoogleDriveImage(
  accessToken: string,
  fileId: string,
  expectedMimeType: string,
  filename: string,
): Promise<Buffer> {
  if (!ALLOWED_MIME_TYPES.has(expectedMimeType)) {
    throw new Error(`Unsupported Google Drive image type: ${expectedMimeType}`);
  }

  const response = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Google Drive download failed for "${filename}" (${response.status}): ${body}`);
  }

  const contentLength = response.headers.get('content-length');

  if (contentLength && Number(contentLength) > MAX_FILE_SIZE) {
    throw new Error(`"${filename}" exceeds the 10 MB image limit.`);
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error(`Google Drive image "${filename}" is empty.`);
  }

  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`"${filename}" exceeds the 10 MB image limit.`);
  }

  return Buffer.from(arrayBuffer);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: batchId } = await context.params;

  try {
    /*
     * The Google Drive access token is intentionally transient.
     *
     * It is supplied by the browser only when a GOOGLE_DRIVE item
     * still needs to be downloaded. It is never persisted in the DB.
     */
    let accessToken: string | null = null;

    try {
      const body = await request.json();

      if (typeof body?.accessToken === 'string') {
        accessToken = body.accessToken;
      }
    } catch {
      // Empty request body is valid for LOCAL batches and for
      // already-downloaded GOOGLE_DRIVE items.
    }

    const batch = await db.extractionBatch.findUnique({
      where: {
        id: batchId,
      },
    });

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch not found.',
        },
        { status: 404 },
      );
    }

    /*
     * Find the oldest queued item.
     */
    const queuedItem = await db.extractionBatchItem.findFirst({
      where: {
        batchId,
        status: 'QUEUED',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!queuedItem) {
      const remaining = await db.extractionBatchItem.count({
        where: {
          batchId,
          status: {
            in: ['QUEUED', 'PROCESSING'],
          },
        },
      });

      if (remaining === 0) {
        await updateBatchStatus(batchId);

        const completedBatch = await db.extractionBatch.findUnique({
          where: {
            id: batchId,
          },
        });

        return NextResponse.json({
          success: true,
          done: true,
          message: 'Batch has no remaining queued items.',
          batch: completedBatch,
          records: [],
        });
      }

      return NextResponse.json({
        success: true,
        done: false,
        message: 'No queued item is currently available.',
        records: [],
      });
    }

    /*
     * Atomically claim the item.
     */
    const claimedItem = await db.extractionBatchItem.updateMany({
      where: {
        id: queuedItem.id,
        status: 'QUEUED',
      },
      data: {
        status: 'PROCESSING',
        attempts: {
          increment: 1,
        },
        startedAt: new Date(),
        error: null,
      },
    });

    if (claimedItem.count !== 1) {
      return NextResponse.json({
        success: true,
        done: false,
        message: 'Another worker claimed the item first.',
        records: [],
      });
    }

    await db.extractionBatch.update({
      where: {
        id: batchId,
      },
      data: {
        status: 'PROCESSING',
        startedAt: batch.startedAt ?? new Date(),
      },
    });

    await db.batchProcessingLog.create({
      data: {
        batchId,
        batchItemId: queuedItem.id,
        event: 'batch.item.started',
        level: 'INFO',
        message: `Started processing ${queuedItem.filename ?? queuedItem.id}.`,
        meta: {
          filename: queuedItem.filename,
          attempt: queuedItem.attempts + 1,
          source: queuedItem.source,
        },
      },
    });

    try {
      const env = getEnv();
      const storage = getStorageProvider(env);
      const provider = getOcrProvider(env);

      let sourceKey = queuedItem.sourceKey;
      let imageBuffer: Buffer;

      /*
       * LOCAL:
       *
       * The image was already stored by /api/batches.
       */
      if (queuedItem.source === 'LOCAL') {
        if (!sourceKey) {
          throw new Error(`Local batch item ${queuedItem.id} has no sourceKey.`);
        }

        imageBuffer = await storage.get(sourceKey);
      }

      /*
       * GOOGLE DRIVE:
       *
       * Download the Drive file only if it has not already
       * been copied into our storage backend.
       */
      else if (queuedItem.source === 'GOOGLE_DRIVE') {
        if (sourceKey) {
          imageBuffer = await storage.get(sourceKey);
        } else {
          if (!accessToken) {
            throw new Error('Google Drive access token is required to download this image.');
          }

          if (!queuedItem.sourceFileId) {
            throw new Error(`Google Drive batch item ${queuedItem.id} has no sourceFileId.`);
          }

          imageBuffer = await downloadGoogleDriveImage(
            accessToken,
            queuedItem.sourceFileId,
            queuedItem.mimeType ?? 'image/jpeg',
            queuedItem.filename ?? 'google-drive-image',
          );

          /*
           * Persist the downloaded image in the configured storage
           * backend. From this point onward the worker can operate
           * exactly like a local batch.
           */
          const stored = await storage.put({
            body: imageBuffer,
            contentType: queuedItem.mimeType ?? 'image/jpeg',
            filename: queuedItem.filename ?? 'google-drive-image',
          });

          sourceKey = stored.key;

          await db.extractionBatchItem.update({
            where: {
              id: queuedItem.id,
            },
            data: {
              sourceKey,
            },
          });

          await db.batchProcessingLog.create({
            data: {
              batchId,
              batchItemId: queuedItem.id,
              event: 'drive.image.stored',
              level: 'INFO',
              message: `Google Drive image downloaded and stored as ${stored.key}.`,
              meta: {
                sourceFileId: queuedItem.sourceFileId,
                sourceKey: stored.key,
                filename: queuedItem.filename,
              },
            },
          });
        }
      } else {
        throw new Error(`Unsupported batch source: ${queuedItem.source}`);
      }

      /*
       * Run the existing OCR pipeline.
       */
      const result = await runExtraction({
        provider,
        input: {
          image: imageBuffer,
          mimeType: queuedItem.mimeType ?? 'image/jpeg',
          filename: queuedItem.filename ?? 'uploaded-image',
        },
        retries: 1,

        onEvent: async (event) => {
          await db.batchProcessingLog.create({
            data: {
              batchId,
              batchItemId: queuedItem.id,
              event: event.event,
              level: event.level,
              message: event.message,
              meta: event.meta ? JSON.parse(JSON.stringify(event.meta)) : undefined,
            },
          });
        },
      });

      console.log(`BATCH OCR RESULT [${queuedItem.filename}]:`, JSON.stringify(result, null, 2));

      if (!Array.isArray(result.records) || result.records.length === 0) {
        throw new Error('OCR completed but no people were detected in the image.');
      }

      /*
       * Create one database Record per extracted person.
       */
      const createdRecords = await db.$transaction(async (tx: any) => {
        const records = [];

        for (const extracted of result.records) {
          const status =
            extracted.overallConfidence < env.LOW_CONFIDENCE_THRESHOLD
              ? 'NEEDS_REVIEW'
              : 'PROCESSED';

          const record = await tx.record.create({
            data: {
              imageUrl: storage.getUrl(sourceKey!),
              imageKey: sourceKey!,

              fullName: extracted.fields.fullName,
              userName: extracted.fields.userName,
              email: extracted.fields.email,
              phoneNumber: extracted.fields.phoneNumber,
              pukNumber: extracted.fields.pukNumber,

              confidence: extracted.overallConfidence,

              fieldConfidences: JSON.parse(JSON.stringify(extracted.fieldConfidences)),

              rawOCR: result.rawText,

              status,
            },
          });

          records.push(record);
        }

        return records;
      });

      const hasReviewItems = createdRecords.some((record: any) => record.status === 'NEEDS_REVIEW');

      await db.extractionBatchItem.update({
        where: {
          id: queuedItem.id,
        },
        data: {
          status: hasReviewItems ? 'NEEDS_REVIEW' : 'COMPLETED',

          recordIds: createdRecords.map((record: any) => record.id),

          completedAt: new Date(),

          error: null,
        },
      });

      await db.batchProcessingLog.create({
        data: {
          batchId,
          batchItemId: queuedItem.id,

          event: 'batch.item.completed',

          level: hasReviewItems ? 'WARN' : 'INFO',

          message: hasReviewItems
            ? `Processed ${createdRecords.length} person(s); at least one requires review.`
            : `Processed ${createdRecords.length} person(s) successfully.`,

          meta: {
            filename: queuedItem.filename,
            recordsExtracted: createdRecords.length,
            recordIds: createdRecords.map((record: any) => record.id),
            warnings: result.warnings,
          },
        },
      });

      await updateBatchStatus(batchId);

      const updatedBatch = await db.extractionBatch.findUnique({
        where: {
          id: batchId,
        },
      });

      const updatedItem = await db.extractionBatchItem.findUnique({
        where: {
          id: queuedItem.id,
        },
      });

      return NextResponse.json({
        success: true,
        done: false,
        item: updatedItem,
        records: createdRecords,
        batch: updatedBatch,
      });
    } catch (error) {
      const message = errorMessage(error);

      console.error(`Batch item ${queuedItem.id} failed:`, error);

      const currentItem = await db.extractionBatchItem.findUnique({
        where: {
          id: queuedItem.id,
        },
      });

      const attempts = currentItem?.attempts ?? 1;
      const permanentlyFailed = attempts >= 3;

      await db.extractionBatchItem.update({
        where: {
          id: queuedItem.id,
        },
        data: {
          status: permanentlyFailed ? 'FAILED' : 'QUEUED',

          error: message,

          completedAt: permanentlyFailed ? new Date() : null,

          startedAt: permanentlyFailed ? currentItem?.startedAt : null,
        },
      });

      await db.batchProcessingLog.create({
        data: {
          batchId,
          batchItemId: queuedItem.id,

          event: permanentlyFailed ? 'batch.item.failed' : 'batch.item.retry',

          level: 'ERROR',

          message: permanentlyFailed
            ? `Item permanently failed after ${attempts} attempt(s): ${message}`
            : `Item failed and will be retried: ${message}`,

          meta: {
            attempts,
            filename: queuedItem.filename,
            error: message,
          },
        },
      });

      await updateBatchStatus(batchId);

      return NextResponse.json({
        success: false,
        done: false,
        retrying: !permanentlyFailed,
        error: message,
        attempts,
        batchItemId: queuedItem.id,
        records: [],
      });
    }
  } catch (error) {
    const message = errorMessage(error);

    console.error('Batch worker failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

async function updateBatchStatus(batchId: string) {
  const [totalItems, queuedItems, processingItems, completedItems, failedItems, reviewItems] =
    await Promise.all([
      db.extractionBatchItem.count({
        where: { batchId },
      }),

      db.extractionBatchItem.count({
        where: {
          batchId,
          status: 'QUEUED',
        },
      }),

      db.extractionBatchItem.count({
        where: {
          batchId,
          status: 'PROCESSING',
        },
      }),

      db.extractionBatchItem.count({
        where: {
          batchId,
          status: 'COMPLETED',
        },
      }),

      db.extractionBatchItem.count({
        where: {
          batchId,
          status: 'FAILED',
        },
      }),

      db.extractionBatchItem.count({
        where: {
          batchId,
          status: 'NEEDS_REVIEW',
        },
      }),
    ]);

  let status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';

  if (processingItems > 0) {
    status = 'PROCESSING';
  } else if (queuedItems > 0) {
    status = 'QUEUED';
  } else if (failedItems > 0 && completedItems === 0 && reviewItems === 0) {
    status = 'FAILED';
  } else if (failedItems > 0) {
    status = 'COMPLETED_WITH_ERRORS';
  } else {
    status = 'COMPLETED';
  }

  const completed = queuedItems === 0 && processingItems === 0;

  return db.extractionBatch.update({
    where: {
      id: batchId,
    },
    data: {
      status,

      totalItems,
      queuedItems,
      processingItems,
      completedItems,
      failedItems,
      reviewItems,

      completedAt: completed ? new Date() : null,
    },
  });
}
