/** Metadata for a stored object, returned by every storage backend. */
export interface StoredObject {
  /** Backend-specific key/path used to reference the object later. */
  key: string;
  /** URL the app can use to display the image. */
  url: string;
}

export interface PutObjectInput {
  /** File bytes to store. */
  body: Buffer;
  /** MIME type, e.g. `image/png`. */
  contentType: string;
  /** Original filename; used to derive a stored key/extension. */
  filename: string;
}

/**
 * A pluggable object store for uploaded images. The local backend writes to disk
 * for zero-config development; the Supabase backend uploads to a bucket. The app
 * depends only on this interface.
 */
export interface StorageProvider {
  readonly name: string;
  /** Stores an object and returns its key and a displayable URL. */
  put(input: PutObjectInput): Promise<StoredObject>;
  /** Removes a previously stored object. Idempotent. */
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Resolves a stored key to a displayable URL. */
  getUrl(key: string): string;
}
