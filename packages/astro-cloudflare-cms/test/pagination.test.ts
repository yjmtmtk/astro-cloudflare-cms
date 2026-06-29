import { describe, it, expect } from 'vitest';
import { parsePage } from '@/lib/pagination';

const u = (qs: string) => new URL('https://x/admin/api/articles' + qs);

describe('parsePage', () => {
  it('returns null when no page param (back-compat: caller returns full list)', () => {
    expect(parsePage(u(''))).toBeNull();
    expect(parsePage(u('?status=hidden'))).toBeNull();
  });
  it('parses page with default pageSize of 20', () => {
    expect(parsePage(u('?page=1'))).toEqual({ page: 1, pageSize: 20, offset: 0 });
    expect(parsePage(u('?page=3'))).toEqual({ page: 3, pageSize: 20, offset: 40 });
  });
  it('honors pageSize and clamps it to 100', () => {
    expect(parsePage(u('?page=2&pageSize=5'))).toEqual({ page: 2, pageSize: 5, offset: 5 });
    expect(parsePage(u('?page=1&pageSize=9999'))?.pageSize).toBe(100);
  });
  it('coerces invalid/out-of-range page to 1', () => {
    expect(parsePage(u('?page=0'))).toEqual({ page: 1, pageSize: 20, offset: 0 });
    expect(parsePage(u('?page=-2'))).toEqual({ page: 1, pageSize: 20, offset: 0 });
    expect(parsePage(u('?page=abc'))).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });
});
