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
