import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 131072;
const R = 8;
const P = 1;
const LENGTH = 64;
let activeHashes = 0;

export class HashCapacityError extends Error {}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  // Bound memory per API instance; callers may retry a 429 rather than exhaust RAM.
  if (activeHashes >= 1) throw new HashCapacityError('PASSWORD_SERVICE_BUSY');
  activeHashes++;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, LENGTH, { N, r: R, p: P, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      activeHashes--;
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export const DUMMY_PASSWORD_HASH = `scrypt$${N}$${R}$${P}$${'00'.repeat(16)}$${'00'.repeat(LENGTH)}`;

export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error('INVALID_PASSWORD_LENGTH');
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const match = /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  if (!match || password.length > 256) return false;
  const key = await derive(password, Buffer.from(match[1]!, 'hex'));
  return timingSafeEqual(key, Buffer.from(match[2]!, 'hex'));
}
