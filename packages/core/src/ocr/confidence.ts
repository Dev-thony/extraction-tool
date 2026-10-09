import {
  EXTRACTION_FIELD_KEYS,
  type ExtractedFields,
  type FieldConfidences,
} from '@extraction/types';

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Derives a single overall confidence (0..1) for an extraction.
 *
 * Preference order:
 *  1. If the model reported per-field confidences for populated fields, average
 *     those — the model's own certainty is the best signal we have.
 *  2. Otherwise fall back to a coverage heuristic: how many of the target fields
 *     came back populated, scaled into a modest 0.4–0.9 band so a "no signal"
 *     result is never presented as high confidence.
 *  3. If nothing was populated, confidence is 0.
 */
export function calculateConfidence(
  fields: ExtractedFields,
  fieldConfidences: FieldConfidences,
): number {
  const populatedKeys = EXTRACTION_FIELD_KEYS.filter(
    (key) => fields[key] !== null && fields[key] !== undefined,
  );

  if (populatedKeys.length === 0) return 0;

  const reported = populatedKeys
    .map((key) => fieldConfidences[key])
    .filter((value): value is number => typeof value === 'number');

  if (reported.length > 0) {
    const mean = reported.reduce((sum, value) => sum + value, 0) / reported.length;
    return clamp01(mean);
  }

  const coverage = populatedKeys.length / EXTRACTION_FIELD_KEYS.length;
  return clamp01(0.4 + 0.5 * coverage);
}
