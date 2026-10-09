import { z } from 'zod';

import { ConfigError } from './errors';

/**
 * Runtime configuration for the core layer. Env vars are untrusted input, so we
 * parse and coerce them through Zod once and hand the rest of the app a typed,
 * validated object. Provider selectors default to the mock/local/dev backends so
 * the platform boots with zero cloud credentials.
 */
export const EnvSchema = z.object({
  // Provider selection
  OCR_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  STORAGE_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  AUTH_PROVIDER: z.enum(['dev', 'supabase']).default('dev'),

  // Google Gemini Vision (only required when OCR_PROVIDER=gemini)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  // Supabase (only required when STORAGE_PROVIDER or AUTH_PROVIDER = supabase)
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('uploads'),

  // Local storage backend
  LOCAL_STORAGE_DIR: z.string().default('storage/uploads'),

  // Dev auth backend
  AUTH_SESSION_SECRET: z.string().min(32, 'AUTH_SESSION_SECRET must be at least 32 characters'),

  ADMIN_EMAIL: z.string().min(1, 'ADMIN_EMAIL is required'),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),

  // Tuning
  LOW_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Parses and caches `process.env`. Throws {@link ConfigError} with a readable
 * summary if any value is malformed, so misconfiguration fails loudly at startup
 * rather than surfacing as a confusing error deep in a request.
 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Clears the cached env. Test-only — lets a suite exercise different configs. */
export function resetEnvCache(): void {
  cached = undefined;
}
