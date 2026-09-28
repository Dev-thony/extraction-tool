import { z } from 'zod';
import { PROCESSING_STATUSES } from './enums';
import { FieldConfidencesSchema } from './extraction';

export const ProcessingStatusSchema = z.enum(PROCESSING_STATUSES);

/**
 * A persisted extraction record. Named `ExtractionRecord` (not `Record`) to
 * avoid shadowing TypeScript's built-in `Record<K, V>` utility type.
 *
 * Dates use `z.coerce.date()` so the same schema validates both server-side
 * `Date` objects and the ISO strings that arrive over JSON.
 */
export const ExtractionRecordSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  imageKey: z.string(),
  fullName: z.string().nullable(),
  userName: z.string().nullable(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  pukNumber: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  fieldConfidences: FieldConfidencesSchema.nullable(),
  rawOCR: z.string().nullable(),
  status: ProcessingStatusSchema,
  uploadedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ExtractionRecord = z.infer<typeof ExtractionRecordSchema>;

/** Payload for creating a record (typically right after upload). */
export const CreateRecordInputSchema = z.object({
  imageUrl: z.string(),
  imageKey: z.string(),
  uploadedBy: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  userName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  pukNumber: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  fieldConfidences: FieldConfidencesSchema.nullable().optional(),
  rawOCR: z.string().nullable().optional(),
  status: ProcessingStatusSchema.optional(),
});
export type CreateRecordInput = z.infer<typeof CreateRecordInputSchema>;

/** Payload for editing a record from the review screen or admin detail page. */
export const UpdateRecordInputSchema = z
  .object({
    fullName: z.string().nullable().optional(),
    userName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    pukNumber: z.string().nullable().optional(),
    status: ProcessingStatusSchema.optional(),
    imageUrl: z.string().optional(),
    imageKey: z.string().optional(),
  })
  .strict();
export type UpdateRecordInput = z.infer<typeof UpdateRecordInputSchema>;
