import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@extraction/types';
import type { Session } from './provider';

const SESSION_ALGORITHM = 'HS256';

function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  session: Session,
  secret: string,
  ttlSeconds = 60 * 60 * 8,
): Promise<string> {
  return new SignJWT({
    email: session.email,
    name: session.name,
    role: session.role,
  })
    .setProtectedHeader({
      alg: SESSION_ALGORITHM,
      typ: 'JWT',
    })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<Session> {
  const { payload } = await jwtVerify(token, getSecret(secret), {
    algorithms: [SESSION_ALGORITHM],
  });

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    (payload.role !== 'ADMIN' && payload.role !== 'STAFF')
  ) {
    throw new Error('Invalid session token');
  }

  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role as Role,
  };
}
