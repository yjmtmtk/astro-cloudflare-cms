import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const { hash, salt } = await hashPassword('s3cret!');
    expect(await verifyPassword('s3cret!', hash, salt)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { hash, salt } = await hashPassword('s3cret!');
    expect(await verifyPassword('wrong', hash, salt)).toBe(false);
  });

  it('produces a unique salt per call', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('is deterministic given the same salt', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same', a.salt);
    expect(b.hash).toBe(a.hash);
  });
});
