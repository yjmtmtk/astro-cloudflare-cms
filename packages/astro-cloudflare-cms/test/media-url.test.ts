import { describe, it, expect } from 'vitest';
import { cmsMediaPath, mediaUrl, resolveMediaHtml } from '@/lib/media-url';

describe('media-url', () => {
  it('cmsMediaPath builds the relative path', () => {
    expect(cmsMediaPath('articles/a.webp')).toBe('/cms-media/articles/a.webp');
  });
  it('mediaUrl uses base when provided (trimming trailing slash), else relative', () => {
    expect(mediaUrl('articles/a.webp', 'https://cdn.example.com')).toBe('https://cdn.example.com/articles/a.webp');
    expect(mediaUrl('articles/a.webp', 'https://cdn.example.com/')).toBe('https://cdn.example.com/articles/a.webp');
    expect(mediaUrl('articles/a.webp', '')).toBe('/cms-media/articles/a.webp');
    expect(mediaUrl('articles/a.webp', undefined)).toBe('/cms-media/articles/a.webp');
  });
  it('resolveMediaHtml rewrites relative refs to the base, or leaves them', () => {
    const html = '<p><img src="/cms-media/articles/a.webp"></p>';
    expect(resolveMediaHtml(html, 'https://cdn.example.com')).toBe('<p><img src="https://cdn.example.com/articles/a.webp"></p>');
    expect(resolveMediaHtml(html, '')).toBe(html);
  });
});
