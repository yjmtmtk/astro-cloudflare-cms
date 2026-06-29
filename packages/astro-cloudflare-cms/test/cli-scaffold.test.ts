import { describe, it, expect } from 'vitest';
import { renderScaffoldPage, sourceDirectiveFor } from '@/cli/scaffold.mjs';

describe('scaffold helpers', () => {
  it('substitutes the layout import token', () => {
    const out = renderScaffoldPage("import Layout from '__LAYOUT_IMPORT__';", '../../layouts/Layout.astro');
    expect(out).toContain("import Layout from '../../layouts/Layout.astro'");
    expect(out).not.toContain('__LAYOUT_IMPORT__');
  });

  it('replaces all occurrences of the token', () => {
    const out = renderScaffoldPage("'__LAYOUT_IMPORT__' and '__LAYOUT_IMPORT__'", '../layouts/Layout.astro');
    expect(out).toBe("'../layouts/Layout.astro' and '../layouts/Layout.astro'");
  });

  it('builds an @source line pointing at the package news components', () => {
    const line = sourceDirectiveFor();
    expect(line).toContain('@source');
    expect(line).toContain('astro-cloudflare-cms');
    expect(line).toContain('news');
  });

  it('sourceDirectiveFor returns a valid CSS @source directive', () => {
    const line = sourceDirectiveFor();
    // Should be a complete @source directive with quotes
    expect(line).toMatch(/@source\s+["'][^"']*astro-cloudflare-cms[^"']*news[^"']*["']/);
  });
});
