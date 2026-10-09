/**
 * Image preprocessing steps built on `sharp`. Cleaning up a photo of handwriting
 * before OCR — normalizing contrast, reducing noise, correcting orientation —
 * measurably improves transcription quality.
 *
 * Each step is a small, independently testable transform over a sharp pipeline.
 */
import type { Sharp } from 'sharp';

export interface PreprocessOptions {
  /** Convert to grayscale. Default true — color rarely helps handwriting OCR. */
  grayscale?: boolean;
  /** Auto-stretch contrast so faint ink separates from the page. Default true. */
  normalize?: boolean;
  /** Light median denoise to remove paper speckle. Default true. */
  denoise?: boolean;
  /** Sharpen strokes after denoising. Default true. */
  sharpen?: boolean;
  /**
   * Brightness multiplier (1 = unchanged). Slightly >1 helps under-exposed
   * phone photos. Default 1.
   */
  brightness?: number;
  /** Attempt skew correction. Default false — estimator is not yet implemented. */
  deskew?: boolean;
}

export const DEFAULT_PREPROCESS_OPTIONS: Required<PreprocessOptions> = {
  grayscale: true,
  normalize: true,
  denoise: true,
  sharpen: true,
  brightness: 1,
  deskew: false,
};

/** EXIF-aware orientation fix so rotated phone photos read upright. */
export function autoOrient(pipeline: Sharp): Sharp {
  return pipeline.rotate();
}

export function applyGrayscale(pipeline: Sharp): Sharp {
  return pipeline.grayscale();
}

export function applyDenoise(pipeline: Sharp): Sharp {
  return pipeline.median(1);
}

export function applyNormalize(pipeline: Sharp): Sharp {
  return pipeline.normalize();
}

export function applyBrightness(pipeline: Sharp, brightness: number): Sharp {
  if (brightness === 1) return pipeline;
  return pipeline.modulate({ brightness });
}

export function applySharpen(pipeline: Sharp): Sharp {
  return pipeline.sharpen();
}

/**
 * Estimates the page skew angle in degrees. Deskewing a scanned form can help
 * line-based OCR, but a robust estimator (Hough transform / projection profile)
 * is out of scope for the foundation. Returns 0 so the pipeline is a no-op until
 * this is implemented.
 *
 * TODO: implement projection-profile skew estimation and rotate by `-angle`.
 */
export function estimateSkewAngle(_pipeline: Sharp): number {
  return 0;
}
