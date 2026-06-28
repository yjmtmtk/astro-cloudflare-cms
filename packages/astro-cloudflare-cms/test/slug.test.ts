import { describe, it, expect } from 'vitest';
import { slugify, ensureSlug } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
    expect(slugify('Special!@#Chars')).toBe('special-chars');
    expect(slugify('already-slug')).toBe('already-slug');
  });
  it('returns empty string for non-ascii-only input', () => {
    expect(slugify('日本語タイトル')).toBe('');
  });
});

describe('ensureSlug', () => {
  it('uses the slugified desired value when usable', () => {
    expect(ensureSlug('My Post')).toBe('my-post');
  });
  it('falls back to a 10-char nanoid for blank/non-ascii', () => {
    const a = ensureSlug('');
    const b = ensureSlug('日本語');
    const c = ensureSlug(null);
    expect(a).toMatch(/^[a-z0-9_-]{10}$/i);
    expect(b).toMatch(/^[a-z0-9_-]{10}$/i);
    expect(c).toMatch(/^[a-z0-9_-]{10}$/i);
    expect(a).not.toBe(b);
  });
});
