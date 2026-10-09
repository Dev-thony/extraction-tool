import { timingSafeEqual } from 'node:crypto';

import type { AuthProvider, Credentials, Session } from './provider';

export interface DevAuthOptions {
  adminEmail: string;
  adminPassword: string;
}

/** Constant-time string comparison to avoid leaking match position via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Development auth backend: a single admin account configured via env. Good
 * enough to gate the admin portal locally without any external identity service.
 * Swapped for {@link SupabaseAuthProvider} by setting `AUTH_PROVIDER=supabase`.
 */
export class DevAuthProvider implements AuthProvider {
  readonly name = 'dev';

  constructor(private readonly options: DevAuthOptions) {}

  async authenticate(credentials: Credentials): Promise<Session | null> {
    const emailOk = safeEqual(
      credentials.email.trim().toLowerCase(),
      this.options.adminEmail.trim().toLowerCase(),
    );
    const passwordOk = safeEqual(credentials.password, this.options.adminPassword);
    if (!emailOk || !passwordOk) return null;

    return {
      userId: 'dev-admin',
      email: this.options.adminEmail,
      name: 'Administrator',
      role: 'ADMIN',
    };
  }
}
