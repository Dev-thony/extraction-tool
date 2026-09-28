import { z } from 'zod';
import { PROCESSING_STATUSES } from './enums';

/** Columns the admin record table can be sorted by. */
export const RECORD_SORT_FIELDS = [
  'createdAt',
  'fullName',
  'userName',
  'email',
  'phoneNumber',
  'status',
  'confidence',
] as const;
export type RecordSortField = (typeof RECORD_SORT_FIELDS)[number];

/**
 * Query parameters for listing records. Everything is coerced from strings so
 * the same schema validates raw URL search params.
 */
export const RecordListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(RECORD_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(PROCESSING_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type RecordListQuery = z.infer<typeof RecordListQuerySchema>;

/** A page of results plus the metadata a table needs to render pagination. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
