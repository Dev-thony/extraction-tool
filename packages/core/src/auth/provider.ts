import type { Role } from '@extraction/types';

/** An authenticated principal. Mirrors the `User` model's public shape. */
export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * A pluggable authentication backend. The dev backend validates a single admin
 * from env; the Supabase backend (later) delegates to Supabase Auth. The app
 * depends only on this interface plus the signed-token helpers.
 */
export interface AuthProvider {
  readonly name: string;
  /** Verifies credentials and returns a Session, or null if they're invalid. */
  authenticate(credentials: Credentials): Promise<Session | null>;
}
