import type { OcrResult } from '@extraction/types';

/** One image handed to an OCR provider. */
export interface OcrInput {
  /** Raw image bytes (already preprocessed, if preprocessing is enabled). */
  image: Buffer;
  /** MIME type, e.g. `image/png` or `image/jpeg`. */
  mimeType: string;
  /** Original filename, used only for logging/diagnostics. */
  filename?: string;
}

/**
 * A pluggable OCR backend. The mock provider satisfies this with deterministic
 * sample data; the Gemini provider satisfies it by calling the Vision API. The
 * rest of the app depends on this interface, never on a concrete provider.
 */
export interface OcrProvider {
  /** Stable identifier for logs and diagnostics, e.g. `mock` or `gemini`. */
  readonly name: string;
  /** Extracts structured fields from one image. Throws on unrecoverable error. */
  extract(input: OcrInput): Promise<OcrResult>;
}
