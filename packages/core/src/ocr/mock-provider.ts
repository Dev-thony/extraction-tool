import type { OcrResult } from '@extraction/types';

import { OcrError } from '../errors';
import type { OcrInput, OcrProvider } from './provider';

export interface MockOcrOptions {
  /** Simulated processing delay in milliseconds. */
  latencyMs?: number;
  /**
   * Number of leading calls that should throw before succeeding. Lets tests and
   * demos exercise the service's retry path deterministically.
   */
  failTimes?: number;
}

/** Sample extraction returned by the mock. One field is deliberately low
 * confidence (and one absent) so the review UI's highlighting is visible without
 * any real OCR backend. */
function sampleResult(): OcrResult {
  return {
    rawText:
      'Full Name: Ada Lovelace\nPartnership Name: ada_l\nEmail: ada@example.com\nPhone: +1 555 0100\nPUK: 1234 5678',

    records: [
      {
        fields: {
          fullName: 'Ada Lovelace',
          userName: 'ada_l',
          email: 'ada@example.com',
          phoneNumber: '+1 555 0100',
          pukNumber: '12345678',
        },

        fieldConfidences: {
          fullName: 0.98,
          userName: 0.91,
          email: 0.95,
          phoneNumber: 0.62,
          pukNumber: 0.88,
        },

        overallConfidence: 0.87,
      },
    ],

    warnings: [],
  };
}

/**
 * Deterministic OCR provider used by default so the platform runs with no cloud
 * credentials. It ignores the image bytes and returns fixed sample data.
 */
export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';
  private calls = 0;

  constructor(private readonly options: MockOcrOptions = {}) {}

  async extract(_input: OcrInput): Promise<OcrResult> {
    this.calls += 1;

    if (this.options.latencyMs && this.options.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
    }

    if (this.options.failTimes && this.calls <= this.options.failTimes) {
      throw new OcrError(`Mock OCR simulated failure (attempt ${this.calls})`);
    }

    return sampleResult();
  }
}
