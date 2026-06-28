import { describe, it, expect } from 'vitest';
import { hashPassword, genSessionSecret } from '../src/cli/crypto.mjs';
import { hashPassword as libHash } from '@/lib/auth';

describe('cli crypto', () => {
  it('produces 32-byte(base64=44) hash and 16-byte(base64=24) salt', async () => {
    const { hash, salt } = await hashPassword('pw');
    expect(hash).toHaveLength(44);
    expect(salt).toHaveLength(24);
  });
  it('is deterministic given the same salt', async () => {
    const a = await hashPassword('pw');
    const b = await hashPassword('pw', a.salt);
    expect(b.hash).toBe(a.hash);
  });
  it('matches the package auth.ts hash byte-for-byte (login parity)', async () => {
    const salt = (await hashPassword('secret')).salt;
    const cli = await hashPassword('secret', salt);
    const lib = await libHash('secret', salt);
    expect(cli.hash).toBe(lib.hash);
  });
  it('genSessionSecret returns 32 random bytes as base64 (44 chars), unique', () => {
    const a = genSessionSecret(), b = genSessionSecret();
    expect(a).toHaveLength(44);
    expect(a).not.toBe(b);
  });
});
