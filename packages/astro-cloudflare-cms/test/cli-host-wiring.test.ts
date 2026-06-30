import { describe, it, expect } from 'vitest';
import { detectHostWiring, formatWiringGuidance } from '../src/cli/host-wiring.mjs';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CANDIDATES = ['astro.config.mjs', 'astro.config.ts'];

/** Build a fake readFile that maps path→content; returns null for unknown paths. */
function fakeFs(files: Record<string, string>) {
  return (path: string): string | null => {
    // Normalize: the helper passes `${cwd}/${name}`, so strip any cwd prefix
    const key = Object.keys(files).find((k) => path.endsWith(k));
    return key !== undefined ? files[key] : null;
  };
}

const FULL_PKG = JSON.stringify({
  dependencies: {
    react: '^19.0.0',
    'react-dom': '^19.0.0',
  },
  devDependencies: {
    '@astrojs/react': '^6.0.0',
    '@astrojs/cloudflare': '^14.0.0',
  },
});

const FULL_CONFIG = `
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import cms from 'astro-cloudflare-cms';
export default defineConfig({ adapter: cloudflare(), integrations: [react(), cms()] });
`;

// ---------------------------------------------------------------------------
// detectHostWiring
// ---------------------------------------------------------------------------

describe('detectHostWiring', () => {
  it('returns present=true when all peers + wiring are found', () => {
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({
        'package.json': FULL_PKG,
        'astro.config.mjs': FULL_CONFIG,
      }),
    });
    expect(report.present).toBe(true);
    expect(report.missingPeers).toEqual([]);
    expect(report.hasCmsIntegration).toBe(true);
    expect(report.hasCloudflareAdapter).toBe(true);
  });

  it('reports missing peers when package.json lacks them', () => {
    const pkg = JSON.stringify({ dependencies: { react: '^19.0.0' } });
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({
        'package.json': pkg,
        'astro.config.mjs': FULL_CONFIG,
      }),
    });
    expect(report.present).toBe(false);
    expect(report.missingPeers).toContain('react-dom');
    expect(report.missingPeers).toContain('@astrojs/react');
    expect(report.missingPeers).toContain('@astrojs/cloudflare');
    expect(report.missingPeers).not.toContain('react');
  });

  it('reports hasCmsIntegration=false when astro.config has no astro-cloudflare-cms reference', () => {
    const config = `import cloudflare from '@astrojs/cloudflare';`;
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({ 'package.json': FULL_PKG, 'astro.config.mjs': config }),
    });
    expect(report.hasCmsIntegration).toBe(false);
    expect(report.hasCloudflareAdapter).toBe(true);
  });

  it('reports hasCloudflareAdapter=false when astro.config has no cloudflare reference', () => {
    const config = `import cms from 'astro-cloudflare-cms';`;
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({ 'package.json': FULL_PKG, 'astro.config.mjs': config }),
    });
    expect(report.hasCmsIntegration).toBe(true);
    expect(report.hasCloudflareAdapter).toBe(false);
  });

  it('handles missing package.json gracefully (all peers absent)', () => {
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({ 'astro.config.mjs': FULL_CONFIG }),
    });
    expect(report.missingPeers).toEqual(['react', 'react-dom', '@astrojs/react', '@astrojs/cloudflare']);
  });

  it('handles missing astro.config gracefully (both flags false)', () => {
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({ 'package.json': FULL_PKG }),
    });
    expect(report.hasCmsIntegration).toBe(false);
    expect(report.hasCloudflareAdapter).toBe(false);
    expect(report.present).toBe(false);
  });

  it('falls back to the second config candidate when the first is absent', () => {
    const report = detectHostWiring({
      cwd: '/project',
      configCandidates: CANDIDATES,
      readFile: fakeFs({ 'package.json': FULL_PKG, 'astro.config.ts': FULL_CONFIG }),
    });
    expect(report.hasCmsIntegration).toBe(true);
    expect(report.hasCloudflareAdapter).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatWiringGuidance
// ---------------------------------------------------------------------------

describe('formatWiringGuidance', () => {
  it('returns null when everything is present', () => {
    const report = { present: true, missingPeers: [], hasCmsIntegration: true, hasCloudflareAdapter: true };
    expect(formatWiringGuidance(report)).toBeNull();
  });

  it('mentions missing peers in the output', () => {
    const report = {
      present: false,
      missingPeers: ['react', 'react-dom'],
      hasCmsIntegration: true,
      hasCloudflareAdapter: true,
    };
    const out = formatWiringGuidance(report);
    expect(out).not.toBeNull();
    expect(out).toContain('npm i react react-dom');
  });

  it('includes config guidance when cms integration is missing', () => {
    const report = {
      present: false,
      missingPeers: [],
      hasCmsIntegration: false,
      hasCloudflareAdapter: true,
    };
    const out = formatWiringGuidance(report);
    expect(out).toContain('astro-cloudflare-cms');
  });

  it('includes adapter guidance when cloudflare adapter is missing', () => {
    const report = {
      present: false,
      missingPeers: [],
      hasCmsIntegration: true,
      hasCloudflareAdapter: false,
    };
    const out = formatWiringGuidance(report);
    expect(out).toContain('@astrojs/cloudflare');
  });

  it('full guidance when all are missing includes install + config block', () => {
    const report = {
      present: false,
      missingPeers: ['react', 'react-dom', '@astrojs/react', '@astrojs/cloudflare'],
      hasCmsIntegration: false,
      hasCloudflareAdapter: false,
    };
    const out = formatWiringGuidance(report)!;
    expect(out).toContain('npm i react react-dom @astrojs/react @astrojs/cloudflare');
    expect(out).toContain('astro-cloudflare-cms');
    expect(out).toContain('cloudflare()');
    expect(out).toContain('defineConfig');
  });
});
