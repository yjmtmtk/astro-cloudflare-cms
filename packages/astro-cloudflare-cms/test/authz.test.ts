import { describe, it, expect } from 'vitest';
import { isMaster, canManageArticle, canCreateArticle } from '@/lib/authz';
import type { SessionUser } from '@/lib/types';

const master: SessionUser = { id: 'm', email: 'm@x', name: 'M', role: 'master' };
const author: SessionUser = { id: 'a', email: 'a@x', name: 'A', role: 'author' };

describe('authz', () => {
  it('isMaster', () => {
    expect(isMaster(master)).toBe(true);
    expect(isMaster(author)).toBe(false);
    expect(isMaster(null)).toBe(false);
  });
  it('canCreateArticle requires any authenticated user', () => {
    expect(canCreateArticle(master)).toBe(true);
    expect(canCreateArticle(author)).toBe(true);
    expect(canCreateArticle(null)).toBe(false);
  });
  it('canManageArticle: master any, author only own', () => {
    expect(canManageArticle(master, { author_id: 'someone' })).toBe(true);
    expect(canManageArticle(author, { author_id: 'a' })).toBe(true);
    expect(canManageArticle(author, { author_id: 'other' })).toBe(false);
    expect(canManageArticle(null, { author_id: 'a' })).toBe(false);
  });
});
