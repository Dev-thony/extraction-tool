/**
 * Domain enums shared across the platform.
 *
 * These values are the single source of truth for the application layer and are
 * kept byte-for-byte identical to the enums declared in `prisma/schema.prisma`.
 * Prisma's schema DSL cannot import from TypeScript, so the two must be updated
 * together — a mismatch will surface as a type error where records are mapped.
 */

export const PROCESSING_STATUSES = [
  'PENDING',
  'PROCESSING',
  'NEEDS_REVIEW',
  'PROCESSED',
  'FAILED',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const ROLES = ['ADMIN', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const LOG_LEVELS = ['INFO', 'WARN', 'ERROR'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
