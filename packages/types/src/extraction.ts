import { z } from 'zod';

export const EXTRACTION_FIELD_KEYS = [
  'fullName',
  'userName',
  'email',
  'phoneNumber',
  'pukNumber',
] as const;

export type ExtractionFieldKey = (typeof EXTRACTION_FIELD_KEYS)[number];

export const ExtractionFieldKeySchema = z.enum(EXTRACTION_FIELD_KEYS);

export const EXTRACTION_FIELD_LABELS: Record<ExtractionFieldKey, string> = {
  fullName: 'Full Name',
  userName: 'Partnership Name',
  email: 'Email',
  phoneNumber: 'Phone Number',
  pukNumber: 'PUK Number',
};

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

export const FieldConfidencesSchema = z.object({
  fullName: z.number().min(0).max(1).optional(),
  userName: z.number().min(0).max(1).optional(),
  email: z.number().min(0).max(1).optional(),
  phoneNumber: z.number().min(0).max(1).optional(),
  pukNumber: z.number().min(0).max(1).optional(),
});

export type FieldConfidences = z.infer<typeof FieldConfidencesSchema>;

/**
 * One person extracted from the image.
 */
export const ExtractedRecordSchema = z.object({
  fields: ExtractedFieldsSchema,
  fieldConfidences: FieldConfidencesSchema,
  overallConfidence: z.number().min(0).max(1),
});

export type ExtractedRecord = z.infer<typeof ExtractedRecordSchema>;

/**
 * Complete OCR result for an image.
 *
 * One image may contain one or many people.
 */
export const OcrResultSchema = z.object({
  rawText: z.string(),
  records: z.array(ExtractedRecordSchema),
  warnings: z.array(z.string()).default([]),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;
