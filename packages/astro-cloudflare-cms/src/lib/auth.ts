import { getUserByEmail, insertSession, getSessionWithUser, deleteSession } from './db';
import type { SessionUser } from './types';

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

// Module-scope encoder — avoids allocating a new TextEncoder on every hashPassword call.
const textEncoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function hashPassword(
  password: string,
  saltB64?: string
): Promise<{ hash: string; salt: string }> {
  const salt: Uint8Array<ArrayBuffer> = saltB64
    ? base64ToBytes(saltB64)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passwordBytes: Uint8Array<ArrayBuffer> = textEncoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_BYTES * 8
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}

export async function verifyPassword(
  password: string,
  hashB64: string,
  saltB64: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, saltB64);
  return timingSafeEqual(hash, hashB64);
}

export const SESSION_COOKIE = 'nanocms_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function toSessionUser(u: {
  id: string; email: string; name: string; role: 'master' | 'author';
}): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function login(
  db: D1Database,
  email: string,
  password: string,
  now: number
): Promise<{ user: SessionUser; sessionId: string; expiresAt: number } | null> {
  const user = await getUserByEmail(db, email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!ok) return null;
  const sessionId = crypto.randomUUID();
  const expiresAt = now + SESSION_TTL_SECONDS;
  await insertSession(db, { id: sessionId, user_id: user.id, expires_at: expiresAt, created_at: now });
  return { user: toSessionUser(user), sessionId, expiresAt };
}

export async function resolveSession(
  db: D1Database,
  sessionId: string,
  now: number
): Promise<SessionUser | null> {
  const found = await getSessionWithUser(db, sessionId);
  if (!found) return null;
  if (found.session.expires_at <= now) {
    await deleteSession(db, sessionId);
    return null;
  }
  return toSessionUser(found.user);
}

export async function logout(db: D1Database, sessionId: string): Promise<void> {
  await deleteSession(db, sessionId);
}

export function cookieAttributes(sessionId: string, expiresAt: number, now: number, secure: boolean): string {
  const maxAge = Math.max(0, expiresAt - now);
  const parts = [`${SESSION_COOKIE}=${sessionId}`, 'HttpOnly'];
  if (secure) parts.push('Secure');
  parts.push('SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function clearedCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly'];
  if (secure) parts.push('Secure');
  parts.push('SameSite=Lax', 'Path=/', 'Max-Age=0');
  return parts.join('; ');
}
