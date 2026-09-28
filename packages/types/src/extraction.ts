import { z } from 'zod';

/**
 * The handwritten fields we attempt to extract from every uploaded image.
 * This ordered list drives OCR prompting, the review form, and spreadsheet
 * column ordering.
 */
export const EXTRACTION_FIELD_KEYS = [
  'fullName',
  'userName',
  'email',
  'phoneNumber',
  'pukNumber',
] as const;
export type ExtractionFieldKey = (typeof EXTRACTION_FIELD_KEYS)[number];

export const ExtractionFieldKeySchema = z.enum(EXTRACTION_FIELD_KEYS);

/** Human-friendly labels. "Partnership Name" is a display alias for `userName`. */
export const EXTRACTION_FIELD_LABELS: Record<ExtractionFieldKey, string> = {
  fullName: 'Full Name',
  userName: 'Partnership Name',
  email: 'Email',
  phoneNumber: 'Phone Number',
  pukNumber: 'PUK Number',
};

/**
 * A single extracted field. Model output is untrusted, so this is deliberately
 * lenient: any scalar is coerced to a trimmed string, and blanks/absent values
 * become `null`. Format correction is the reviewer's job, not the parser's — we
 * never discard a value just because it looks malformed.
 */
const looseField = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}, z.string().nullable());

export const ExtractedFieldsSchema = z.object({
  fullName: looseField,
  userName: looseField,
  email: looseField,
  phoneNumber: looseField,
  pukNumber: looseField,
});
export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;

/** Per-field confidence in the range 0..1. Any subset of fields may be present. */
export const FieldConfidencesSchema = z.object({
  fullName: z.number().min(0).max(1).optional(),
  userName: z.number().min(0).max(1).optional(),
  email: z.number().min(0).max(1).optional(),
  phoneNumber: z.number().min(0).max(1).optional(),
  pukNumber: z.number().min(0).max(1).optional(),
});
export type FieldConfidences = z.infer<typeof FieldConfidencesSchema>;

/** The normalized result an `OcrProvider` returns for one image. */
export const OcrResultSchema = z.object({
  rawText: z.string(),
  fields: ExtractedFieldsSchema,
  fieldConfidences: FieldConfidencesSchema,
  overallConfidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});
export type OcrResult = z.infer<typeof OcrResultSchema>;
