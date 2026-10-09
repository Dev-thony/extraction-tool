import type { OcrResult } from '@extraction/types';

import { OcrError } from '../errors';
import type { OcrInput, OcrProvider } from './provider';

/** A structured event emitted during extraction, suitable for persisting as a
 * ProcessingLog. The core layer stays decoupled from the database by reporting
 * through this callback rather than importing `@extraction/db`. */
export interface ExtractionEvent {
  event: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta?: Record<string, unknown>;
}

export interface RunExtractionArgs {
  provider: OcrProvider;
  input: OcrInput;
  /** Retries after the first attempt. Default 1 → up to 2 attempts total. */
  retries?: number;
  /** Called for each lifecycle event (attempt started, succeeded, failed). */
  onEvent?: (event: ExtractionEvent) => void | Promise<void>;
}

/**
 * Runs an OCR provider with a bounded retry loop, emitting lifecycle events.
 *
 * Retries cover transient provider failures and malformed model output alike.
 * When every attempt fails, the last error is rethrown (wrapped in
 * {@link OcrError}) so the caller can mark the record FAILED.
 */
export async function runExtraction({
  provider,
  input,
  retries = 1,
  onEvent,
}: RunExtractionArgs): Promise<OcrResult> {
  const maxAttempts = Math.max(1, retries + 1);
  const emit = async (event: ExtractionEvent): Promise<void> => {
    await onEvent?.(event);
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await emit({
      event: 'ocr.attempt',
      level: 'INFO',
      message: `OCR attempt ${attempt}/${maxAttempts} via ${provider.name}`,
      meta: { attempt, maxAttempts, provider: provider.name },
    });

    try {
      const result = await provider.extract(input);
      await emit({
        event: 'ocr.success',
        level: 'INFO',
        message: `OCR succeeded on attempt ${attempt} with ${result.records.length} record(s)`,
        meta: {
          attempt,
          recordCount: result.records.length,
          overallConfidence:
            result.records.length > 0
              ? result.records.reduce((sum, record) => sum + record.overallConfidence, 0) /
                result.records.length
              : 0,
        },
      });
      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      await emit({
        event: 'ocr.failure',
        level: attempt < maxAttempts ? 'WARN' : 'ERROR',
        message: `OCR attempt ${attempt} failed: ${message}`,
        meta: { attempt, maxAttempts },
      });
    }
  }

  throw new OcrError(
    `OCR failed after ${maxAttempts} attempt(s) via ${provider.name}`,
    lastError,
  );
}
