import { NextResponse } from 'next/server';

import { getEnv, getOcrProvider, getStorageProvider, runExtraction } from '@extraction/core';

import { prisma } from '@extraction/db';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  let storedKey: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: 'No image file was provided.',
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: 'Unsupported image type. Use JPG, PNG, or WEBP.',
        },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        {
          error: 'The uploaded image is empty.',
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'The image must be smaller than 10 MB.',
        },
        { status: 400 },
      );
    }

    const env = getEnv();

    const storage = getStorageProvider(env);
    const provider = getOcrProvider(env);

    const imageBuffer = Buffer.from(await file.arrayBuffer());

    /*
     * Store the original image once.
     *
     * Every extracted person references this same image.
     */
    const stored = await storage.put({
      body: imageBuffer,
      contentType: file.type,
      filename: file.name,
    });

    storedKey = stored.key;

    /*
     * OCR lifecycle events cannot reference a database record yet because
     * records are only created after we know how many people were extracted.
     *
     * We therefore log the OCR events without a recordId.
     */
    const result = await runExtraction({
      provider,
      input: {
        image: imageBuffer,
        mimeType: file.type,
        filename: file.name,
      },
      retries: 1,
    });

    console.log('OCR RESULT:', JSON.stringify(result, null, 2));

    /*
     * Make sure the provider returned a usable extraction result.
     */
    if (!result || !Array.isArray(result.records)) {
      throw new Error('OCR provider returned an invalid extraction result.');
    }

    if (result.records.length === 0) {
      await storage.remove(stored.key);
      storedKey = null;

      return NextResponse.json(
        {
          success: false,
          error: 'No people were detected in the uploaded image.',
        },
        { status: 422 },
      );
    }

    /*
     * Create one database Record for every extracted person.
     */
    const createdRecords = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const [index, extracted] of result.records.entries()) {
        const status =
          extracted.overallConfidence < env.LOW_CONFIDENCE_THRESHOLD ? 'NEEDS_REVIEW' : 'PROCESSED';

        const record = await tx.record.create({
          data: {
            imageUrl: stored.url,
            imageKey: stored.key,

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

        await tx.processingLog.create({
          data: {
            recordId: record.id,
            event: 'extraction.completed',

            level: status === 'NEEDS_REVIEW' ? 'WARN' : 'INFO',

            message:
              status === 'NEEDS_REVIEW'
                ? 'Person extracted but requires review because confidence is below the configured threshold.'
                : 'Person extracted successfully.',

            meta: {
              recordNumber: index + 1,
              totalRecords: result.records.length,
              overallConfidence: extracted.overallConfidence,
              status,
              warnings: result.warnings,
            },
          },
        });

        records.push(record);
      }

      return records;
    });

    /*
     * Create a summary log for every extracted record.
     */
    await prisma.processingLog.createMany({
      data: createdRecords.map((record) => ({
        recordId: record.id,
        event: 'extraction.summary',
        level: 'INFO' as const,
        message: `Extraction completed using ${provider.name} OCR provider.`,
        meta: {
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          provider: provider.name,
          recordsExtracted: result.records.length,
        },
      })),
    });

    return NextResponse.json({
      success: true,
      count: createdRecords.length,
      records: createdRecords,
      warnings: result.warnings,
    });
  } catch (error) {
    const message = errorMessage(error);

    /*
     * If storage succeeded but processing failed,
     * remove the orphaned image.
     */
    if (storedKey) {
      try {
        const env = getEnv();
        const storage = getStorageProvider(env);

        await storage.remove(storedKey);
      } catch {
        // Do not hide the original extraction error.
      }
    }

    console.error('Extraction request failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
