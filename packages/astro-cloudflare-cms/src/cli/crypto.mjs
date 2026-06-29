const ITERATIONS = 100_000, KEY_BYTES = 32, SALT_BYTES = 16;
const enc = new TextEncoder();

function bytesToBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(password, saltB64) {
  const salt = saltB64
    ? base64ToBytes(saltB64)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    km,
    KEY_BYTES * 8
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}

export function genSessionSecret() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

// Unambiguous charset: no 0/O/1/l/I to avoid transcription errors.
const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Generate a random password from an unambiguous alphabet (WebCrypto).
 * Rejection-samples so the distribution stays uniform across the alphabet.
 * @param {number} [length=16]
 * @returns {string}
 */
export function genPassword(length = 16) {
  const n = PW_ALPHABET.length;
  const max = Math.floor(256 / n) * n; // largest multiple of n <= 256 (for rejection sampling)
  let out = '';
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length - out.length));
    for (const b of buf) {
      if (b < max) out += PW_ALPHABET[b % n];
    }
  }
  return out;
}
