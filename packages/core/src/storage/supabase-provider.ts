import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { StorageError } from '../errors';
import type { PutObjectInput, StorageProvider, StoredObject } from './provider';

export interface SupabaseStorageOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

/**
 * Supabase Storage backend.
 *
 * The client is imported dynamically so the default local setup does not need
 * @supabase/supabase-js resolved at module-load time.
 *
 * The service-role key is server-side only.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';

  constructor(private readonly options: SupabaseStorageOptions) {}

  private async client() {
    const { createClient } = await import('@supabase/supabase-js');

    return createClient(this.options.url, this.options.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async get(key: string): Promise<Buffer> {
    const supabase = await this.client();

    const { data, error } = await supabase.storage.from(this.options.bucket).download(key);

    if (error) {
      throw new StorageError(`Supabase download failed: ${error.message}`, error);
    }

    if (!data) {
      throw new StorageError(`Supabase download returned no data for key: ${key}`);
    }

    try {
      return Buffer.from(await data.arrayBuffer());
    } catch (cause) {
      throw new StorageError(`Failed to read downloaded Supabase object: ${key}`, cause);
    }
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const ext = path.extname(input.filename) || '';
    const key = `${randomUUID()}${ext}`;

    const supabase = await this.client();

    const { error } = await supabase.storage.from(this.options.bucket).upload(key, input.body, {
      contentType: input.contentType,
      upsert: false,
    });

    if (error) {
      throw new StorageError(`Supabase upload failed: ${error.message}`, error);
    }

    return {
      key,
      url: this.getUrl(key),
    };
  }

  async remove(key: string): Promise<void> {
    const supabase = await this.client();

    const { error } = await supabase.storage.from(this.options.bucket).remove([key]);

    if (error) {
      throw new StorageError(`Supabase remove failed: ${error.message}`, error);
    }
  }

  getUrl(key: string): string {
    const base = this.options.url.replace(/\/$/, '');

    return `${base}/storage/v1/object/public/${this.options.bucket}/${key}`;
  }
}
