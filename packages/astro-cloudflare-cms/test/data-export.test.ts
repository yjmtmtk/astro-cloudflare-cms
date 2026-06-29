import { describe, it, expect } from 'vitest';
import * as data from '@/data';
describe('data barrel', () => {
  it('re-exports the public read helpers', () => {
    expect(typeof data.listPublicArticles).toBe('function');
    expect(typeof data.getPublicArticleBySlug).toBe('function');
    expect(typeof data.eyecatchOf).toBe('function');
    expect(typeof data.renderBody).toBe('function');
  });
});
