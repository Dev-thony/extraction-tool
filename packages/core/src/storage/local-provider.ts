import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { StorageError } from '../errors';
import type { PutObjectInput, StorageProvider, StoredObject } from './provider';

/** Maps common image MIME types to a file extension for stored keys. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extensionFor(input: PutObjectInput): string {
  const fromType = EXTENSION_BY_TYPE[input.contentType.toLowerCase()];
  if (fromType) return fromType;
  const fromName = path.extname(input.filename).replace('.', '').toLowerCase();
  return fromName || 'bin';
}

export interface LocalStorageOptions {
  /** Directory on disk where objects are written. */
  dir: string;
  /** Public URL base that maps to {@link dir}. Default `/uploads`. */
  publicBase?: string;
}

/**
 * Filesystem-backed storage for local development. Objects are written under a
 * configured directory and served via a static route. Keys are random UUIDs so
 * uploads never collide or leak the original filename.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly dir: string;
  private readonly publicBase: string;

  constructor(options: LocalStorageOptions) {
    this.dir = options.dir;
    this.publicBase = (options.publicBase ?? '/uploads').replace(/\/$/, '');
  }

  async get(key: string): Promise<Buffer> {
    const filePath = path.join(this.dir, key);

    return readFile(filePath);
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const key = `${randomUUID()}.${extensionFor(input)}`;
    const target = path.join(this.dir, key);
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(target, input.body);
    } catch (cause) {
      throw new StorageError(`Failed to write ${target}`, cause);
    }
    return { key, url: this.getUrl(key) };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(path.join(this.dir, key));
    } catch (cause) {
      // Missing file is fine (idempotent delete); anything else is an error.
      if ((cause as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      throw new StorageError(`Failed to remove ${key}`, cause);
    }
  }

  getUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }
}
