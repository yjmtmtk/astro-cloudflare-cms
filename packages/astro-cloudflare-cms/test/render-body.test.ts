import { describe, it, expect } from 'vitest';
import { renderBody } from '@/lib/render-body';

describe('renderBody', () => {
  it('sanitizes then resolves media urls to the base', () => {
    const html = '<p><img src="/cms-media/articles/a.webp"><script>alert(1)</script></p>';
    const out = renderBody(html, 'https://cdn.x');
    expect(out).not.toContain('<script');
    expect(out).toContain('src="https://cdn.x/articles/a.webp"');
  });
  it('leaves relative media when no base', () => {
    expect(renderBody('<p><img src="/cms-media/a.webp"></p>', '')).toContain('src="/cms-media/a.webp"');
  });
});
