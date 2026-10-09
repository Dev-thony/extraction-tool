import { getEnv, getOcrProvider, getStorageProvider, runExtraction } from '@extraction/core';

import { prisma } from '@extraction/db';

const MAX_CONCURRENCY = 3;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function processBatchItem(itemId: string): Promise<void> {
  const env = getEnv();

  const provider = getOcrProvider(env);

  const storage = getStorageProvider(env);

  const db = prisma as any;

  /*
   * Atomically claim the job.
   *
   * Only QUEUED jobs can be claimed.
   */
  const claimed = await db.extractionBatchItem.updateMany({
    where: {
      id: itemId,
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

  if (claimed.count !== 1) {
    return;
  }

  const item = await db.extractionBatchItem.findUnique({
    where: {
      id: itemId,
    },

    include: {
      batch: true,
    },
  });

  if (!item) {
    return;
  }

  try {
    let imageBuffer: Buffer;

    /*
     * Local / ZIP image.
     */
    if (item.source === 'LOCAL') {
      if (!item.sourceKey) {
        throw new Error('Local batch item has no storage key.');
      }

      /*
       * Your storage abstraction currently exposes put/getUrl/remove.
       *
       * We will add a read method before enabling
       * local batch processing.
       */
      throw new Error('Storage read support is required for batch processing.');
    }

    /*
     * Google Drive will be implemented using the
     * durable Google Drive connection in the next part.
     */
    if (item.source === 'GOOGLE_DRIVE') {
      throw new Error('Google Drive batch download is not connected yet.');
    }

    throw new Error(`Unsupported batch source: ${item.source}`);
  } catch (error) {
    const message = errorMessage(error);

    await db.extractionBatchItem.update({
      where: {
        id: itemId,
      },

      data: {
        status: 'FAILED',
        error: message,
        completedAt: new Date(),
      },
    });

    await db.processingLog.create({
      data: {
        recordId: null,
        event: 'batch.item.failed',
        level: 'ERROR',
        message,
        meta: {
          batchId: item.batchId,
          batchItemId: item.id,
          attempts: item.attempts,
        },
      },
    });
  }
}
