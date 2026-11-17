import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

/**
 * Password hashing (M1 security requirement).
 *
 * scrypt (memory-hard KDF) with per-user random salt, standardized encoded
 * format so parameters can be upgraded later without invalidating hashes:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }
  );
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return false;
    }
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scryptAsync(
      password.normalize("NFKC"),
      salt,
      expected.length,
      { N, r, p }
    );
    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}

/**
 * A throwaway hash used to equalize timing when the submitted email does
 * not exist — prevents user-enumeration via response-time differences on
 * the login endpoint.
 */
const DUMMY_PASSWORD = "orbit-crew-timing-equalizer-DO-NOT-USE";
let dummyHashPromise: Promise<string> | null = null;

export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(DUMMY_PASSWORD);
  return dummyHashPromise;
}
