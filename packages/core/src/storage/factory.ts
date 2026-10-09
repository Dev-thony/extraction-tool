import type { Env } from '../env';
import { ConfigError } from '../errors';
import { LocalStorageProvider } from './local-provider';
import type { StorageProvider } from './provider';
import { SupabaseStorageProvider } from './supabase-provider';

/** Selects the storage backend from configuration. Defaults to local disk. */
export function getStorageProvider(env: Env): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case 'supabase': {
      if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new ConfigError(
          'STORAGE_PROVIDER=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
        );
      }
      return new SupabaseStorageProvider({
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        bucket: env.SUPABASE_STORAGE_BUCKET,
      });
    }
    case 'local':
      return new LocalStorageProvider({ dir: env.LOCAL_STORAGE_DIR });
    default: {
      const never: never = env.STORAGE_PROVIDER;
      throw new ConfigError(`Unknown STORAGE_PROVIDER: ${String(never)}`);
    }
  }
}
