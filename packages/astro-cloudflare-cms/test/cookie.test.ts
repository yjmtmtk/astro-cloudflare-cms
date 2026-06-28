import { describe, it, expect } from 'vitest';
import { cookieAttributes, clearedCookie, SESSION_COOKIE } from '@/lib/auth';

describe('cookieAttributes', () => {
  it('includes Secure only when secure=true', () => {
    const withSecure = cookieAttributes('sid', 1000, 0, true);
    const noSecure = cookieAttributes('sid', 1000, 0, false);
    expect(withSecure).toContain('Secure');
    expect(noSecure).not.toContain('Secure');
  });
  it('always sets HttpOnly, SameSite=Lax, Path=/ and a Max-Age', () => {
    const c = cookieAttributes('sid', 700, 100, false);
    expect(c).toContain(`${SESSION_COOKIE}=sid`);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(c).toContain('Max-Age=600');
  });
  it('clamps Max-Age to 0 when already expired', () => {
    expect(cookieAttributes('sid', 100, 999, false)).toContain('Max-Age=0');
  });
});

describe('clearedCookie', () => {
  it('uses Max-Age=0 and respects secure flag', () => {
    expect(clearedCookie(true)).toContain('Secure');
    expect(clearedCookie(false)).not.toContain('Secure');
    expect(clearedCookie(false)).toContain('Max-Age=0');
    expect(clearedCookie(false)).toContain(`${SESSION_COOKIE}=`);
  });
});
