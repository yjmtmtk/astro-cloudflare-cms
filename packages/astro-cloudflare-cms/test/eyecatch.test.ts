import { describe, it, expect } from 'vitest';
import { eyecatchOf, generatePlaceholder } from '@/lib/eyecatch';

const base = { title: 'Hello', category_id: null };

describe('generatePlaceholder', () => {
  it('is a deterministic data svg uri', () => {
    const a = generatePlaceholder({ title: 'Hello' });
    const b = generatePlaceholder({ title: 'Hello' });
    expect(a).toBe(b);
    expect(a.startsWith('data:image/svg+xml,')).toBe(true);
  });
  it('differs for different titles', () => {
    expect(generatePlaceholder({ title: 'Hello' })).not.toBe(generatePlaceholder({ title: 'World' }));
  });
});

describe('eyecatchOf', () => {
  it('uses eyecatch_url, resolving /cms-media to base', () => {
    expect(eyecatchOf({ ...base, eyecatch_url: '/cms-media/articles/a.webp' }, { baseUrl: 'https://cdn.x' }))
      .toBe('https://cdn.x/articles/a.webp');
    expect(eyecatchOf({ ...base, eyecatch_url: '/cms-media/articles/a.webp' }, {}))
      .toBe('/cms-media/articles/a.webp');
  });
  it('falls back to defaultUrl then placeholder', () => {
    expect(eyecatchOf({ ...base, eyecatch_url: null }, { defaultUrl: 'https://x/d.png' })).toBe('https://x/d.png');
    const ph = eyecatchOf({ ...base, eyecatch_url: null }, {});
    expect(ph.startsWith('data:image/svg+xml,')).toBe(true);
  });
});
