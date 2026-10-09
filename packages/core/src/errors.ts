/**
 * Typed error hierarchy for the core layer.
 * Distinguishing error kinds lets API routes map failures to the right
 * HTTP status and lets the OCR service decide what is worth retrying.
 */

export class CoreError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

/** Configuration/environment problem (missing key, bad provider name). */
export class ConfigError extends CoreError {}

/** The OCR provider failed to produce a usable result. */
export class OcrError extends CoreError {}

/** Model output could not be parsed/validated into the expected schema. */
export class OcrParseError extends OcrError {}

/** A storage backend operation failed. */
export class StorageError extends CoreError {}
