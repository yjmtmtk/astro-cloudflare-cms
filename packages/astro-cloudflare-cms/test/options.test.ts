import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../src/options';

describe('resolveOptions', () => {
  it('fills defaults when nothing is passed', () => {
    expect(resolveOptions()).toEqual({
      adminBasePath: '/admin',
      newsBasePath: '/news',
      mediaBasePath: '/cms-media',
      brand: 'astro-cloudflare-cms',
      defaultEyecatchUrl: '',
      news: { layout: 'src/layouts/Layout.astro' },
    });
  });

  it('normalizes paths to a leading slash with no trailing slash', () => {
    const r = resolveOptions({ adminBasePath: 'cms/', newsBasePath: '/blog/', mediaBasePath: 'media' });
    expect(r.adminBasePath).toBe('/cms');
    expect(r.newsBasePath).toBe('/blog');
    expect(r.mediaBasePath).toBe('/media');
  });

  it('passes through brand and defaultEyecatchUrl', () => {
    const r = resolveOptions({ brand: 'My CMS', defaultEyecatchUrl: 'https://x/d.png' });
    expect(r.brand).toBe('My CMS');
    expect(r.defaultEyecatchUrl).toBe('https://x/d.png');
  });
});
