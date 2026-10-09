import sharp from 'sharp';

import {
  DEFAULT_PREPROCESS_OPTIONS,
  applyBrightness,
  applyDenoise,
  applyGrayscale,
  applyNormalize,
  applySharpen,
  autoOrient,
  estimateSkewAngle,
  type PreprocessOptions,
} from './steps';

export interface PreprocessResult {
  /** Processed image bytes, PNG-encoded for lossless downstream OCR. */
  image: Buffer;
  /** MIME type of {@link image}. */
  mimeType: string;
  /** Which steps actually ran, for logging/diagnostics. */
  applied: string[];
}

/**
 * Runs the enabled preprocessing steps over an image and returns PNG bytes.
 *
 * Order matters: orient first, then drop color, denoise, correct exposure,
 * stretch contrast, and finally sharpen the cleaned strokes.
 */
export async function preprocessImage(
  input: Buffer,
  options: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const opts = { ...DEFAULT_PREPROCESS_OPTIONS, ...options };
  const applied: string[] = [];

  let pipeline = sharp(input, { failOn: 'none' });
  pipeline = autoOrient(pipeline);
  applied.push('autoOrient');

  if (opts.grayscale) {
    pipeline = applyGrayscale(pipeline);
    applied.push('grayscale');
  }
  if (opts.denoise) {
    pipeline = applyDenoise(pipeline);
    applied.push('denoise');
  }
  if (opts.brightness !== 1) {
    pipeline = applyBrightness(pipeline, opts.brightness);
    applied.push('brightness');
  }
  if (opts.normalize) {
    pipeline = applyNormalize(pipeline);
    applied.push('normalize');
  }
  if (opts.sharpen) {
    pipeline = applySharpen(pipeline);
    applied.push('sharpen');
  }
  if (opts.deskew) {
    // Estimator is a stub (returns 0) until projection-profile detection lands.
    const angle = estimateSkewAngle(pipeline);
    if (angle !== 0) {
      pipeline = pipeline.rotate(-angle, { background: '#ffffff' });
      applied.push('deskew');
    }
  }

  const image = await pipeline.png().toBuffer();
  return { image, mimeType: 'image/png', applied };
}
