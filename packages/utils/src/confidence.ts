export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** Fields scoring below this (0..1) are flagged for review by default. */
export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Buckets a 0..1 confidence into a level used for badges and highlighting. */
export function confidenceLevel(
  value: number,
  lowThreshold: number = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
): ConfidenceLevel {
  if (value < lowThreshold) return 'low';
  if (value < Math.min(1, lowThreshold + 0.15)) return 'medium';
  return 'high';
}

/** A missing confidence is treated as low so it never slips through review. */
export function isLowConfidence(
  value: number | null | undefined,
  lowThreshold: number = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
): boolean {
  if (value === null || value === undefined) return true;
  return value < lowThreshold;
}

/** Formats a 0..1 confidence as a whole percentage, or an em dash if unknown. */
export function formatConfidencePercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

/** Mean of the provided confidences, ignoring nullish entries. */
export function averageConfidence(values: Array<number | null | undefined>): number | null {
  const numbers = values.filter((value): value is number => typeof value === 'number');
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}
