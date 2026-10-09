import { NextResponse } from 'next/server';

import { prisma } from '@extraction/db';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const MAX_ITEMS = 5000;

type SelectedItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  kind: 'file' | 'folder';
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function driveRequest<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${DRIVE_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Google Drive API error (${response.status}): ${body}`,
    );
  }

  return response.json() as Promise<T>;
}

async function listFolderImages(
  accessToken: string,
  folderId: string,
): Promise<SelectedItem[]> {
  const results: SelectedItem[] = [];

  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams();

    params.set(
      'q',
      `'${folderId}' in parents and trashed = false`,
    );

    params.set(
      'fields',
      'nextPageToken,files(id,name,mimeType,size)',
    );

    params.set('pageSize', '1000');

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    params.set('includeItemsFromAllDrives', 'true');
    params.set('supportsAllDrives', 'true');

    const data = await driveRequest<{
      files: DriveFile[];
      nextPageToken?: string;
    }>(
      accessToken,
      `/files?${params.toString()}`,
    );

    for (const file of data.files) {
      if (IMAGE_MIME_TYPES.has(file.mimeType)) {
        results.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size
            ? Number(file.size)
            : undefined,
          kind: 'file',
        });
      }

      /*
       * Recursively process subfolders.
       */
      if (file.mimeType === FOLDER_MIME_TYPE) {
        const nested = await listFolderImages(
          accessToken,
          file.id,
        );

        results.push(...nested);
      }

      if (results.length >= MAX_ITEMS) {
        return results.slice(0, MAX_ITEMS);
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const accessToken =
      typeof body.accessToken === 'string'
        ? body.accessToken
        : null;

    const items = Array.isArray(body.items)
      ? (body.items as SelectedItem[])
      : [];

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Drive access token is missing.',
        },
        { status: 401 },
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No Google Drive files were selected.',
        },
        { status: 400 },
      );
    }

    /*
     * Resolve selected files and folders into individual images.
     */
    const resolved = new Map<string, SelectedItem>();

    for (const item of items) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.mimeType !== 'string'
      ) {
        continue;
      }

      /*
       * Direct image.
       */
      if (IMAGE_MIME_TYPES.has(item.mimeType)) {
        resolved.set(item.id, {
          id: item.id,
          name:
            typeof item.name === 'string'
              ? item.name
              : 'Google Drive image',
          mimeType: item.mimeType,
          size:
            typeof item.size === 'number'
              ? item.size
              : undefined,
          kind: 'file',
        });

        continue;
      }

      /*
       * Folder.
       */
      if (item.mimeType === FOLDER_MIME_TYPE) {
        const images = await listFolderImages(
          accessToken,
          item.id,
        );

        for (const image of images) {
          resolved.set(image.id, image);
        }
      }
    }

    const finalItems = Array.from(resolved.values()).slice(
      0,
      MAX_ITEMS,
    );

    if (finalItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No supported JPG, PNG, or WEBP images were found in the Google Drive selection.',
        },
        { status: 422 },
      );
    }

    /*
     * Create the Google Drive batch and all queue items atomically.
     *
     * No images are downloaded here.
     *
     * The access token remains in the browser. The persistent batch
     * only stores the Drive file ID needed by the worker.
     */
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await (tx as any).extractionBatch.create({
        data: {
          name: `Google Drive Batch ${new Date().toLocaleString()}`,

          source: 'GOOGLE_DRIVE',

          status: 'QUEUED',

          totalItems: finalItems.length,

          queuedItems: finalItems.length,

          processingItems: 0,

          completedItems: 0,

          failedItems: 0,

          reviewItems: 0,
        },
      });

      await (tx as any).extractionBatchItem.createMany({
        data: finalItems.map((item) => ({
          batchId: createdBatch.id,

          status: 'QUEUED',

          filename: item.name,

          mimeType: item.mimeType,

          source: 'GOOGLE_DRIVE',

          sourceFileId: item.id,

          sourceKey: null,

          recordIds: [],

          attempts: 0,
        })),
      });

      await (tx as any).batchProcessingLog.create({
        data: {
          batchId: createdBatch.id,

          event: 'batch.created',

          level: 'INFO',

          message: `Google Drive batch created with ${finalItems.length} queued item(s).`,

          meta: {
            source: 'GOOGLE_DRIVE',

            totalItems: finalItems.length,
          },
        },
      });

      return createdBatch;
    });

    const batchItems = await (prisma as any).extractionBatchItem.findMany({
      where: {
        batchId: batch.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(
      {
        success: true,

        count: finalItems.length,

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

        items: finalItems,

        batchItems,

        manifest: finalItems.map((item) => ({
          source: 'google_drive',

          fileId: item.id,

          filename: item.name,

          mimeType: item.mimeType,

          size: item.size ?? null,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      'Google Drive preparation failed:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage(error),
      },
      { status: 500 },
    );
  }
}
