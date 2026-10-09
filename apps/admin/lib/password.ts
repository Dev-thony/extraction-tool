import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('Password must contain at least 12 characters.');
  }

  if (password.length > 128) {
    throw new Error('Password must not exceed 128 characters.');
  }

  const salt = randomBytes(16).toString('hex');

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hashHex, ...extra] = storedHash.split(':');

  if (
    algorithm !== 'scrypt' ||
    !salt ||
    !hashHex ||
    extra.length > 0 ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(hashHex)
  ) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');

  const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
