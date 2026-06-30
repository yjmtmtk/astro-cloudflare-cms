/**
 * host-wiring.mjs
 *
 * Pure helpers (no node:child_process at module top — safe to import in the
 * vitest workers pool) that detect whether a host project has the peer
 * dependencies and astro.config wiring needed for astro-cloudflare-cms.
 *
 * All I/O is injected via the `readFile` parameter so the logic is fully
 * unit-testable without touching the real filesystem.
 */

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ present: boolean; missingPeers: string[]; hasCmsIntegration: boolean; hasCloudflareAdapter: boolean }} WiringReport
 */

// ---------------------------------------------------------------------------
// Peer deps we require on the host
// ---------------------------------------------------------------------------

const REQUIRED_PEERS = ['react', 'react-dom', '@astrojs/react', '@astrojs/cloudflare'];

// ---------------------------------------------------------------------------
// detectHostWiring
// ---------------------------------------------------------------------------

/**
 * Detect missing peer deps and astro.config wiring.
 *
 * Pure function — all filesystem reads go through the injected `readFile`
 * callback so this is easily unit-testable.
 *
 * @param {object} opts
 * @param {string}   opts.cwd          Project root directory
 * @param {string[]} opts.configCandidates  Filenames to try in order for the astro config
 * @param {(path: string) => string | null} opts.readFile
 *   Read a file as UTF-8 string, return null if not found.
 * @returns {WiringReport}
 */
export function detectHostWiring({ cwd, configCandidates, readFile }) {
  // ---- package.json: collect all dep keys --------------------------------
  const pkgText = readFile(`${cwd}/package.json`);
  let allDeps = /** @type {string[]} */ ([]);
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      allDeps = Object.keys({
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.peerDependencies ?? {}),
      });
    } catch {
      // unparseable package.json — treat all deps as absent
    }
  }
  const missingPeers = REQUIRED_PEERS.filter((p) => !allDeps.includes(p));

  // ---- astro config: look for cms() and cloudflare adapter ---------------
  let hasCmsIntegration = false;
  let hasCloudflareAdapter = false;

  for (const name of configCandidates) {
    const text = readFile(`${cwd}/${name}`);
    if (text === null) continue;
    // Presence of the import (covers import/require, any alias)
    hasCmsIntegration = /astro-cloudflare-cms/.test(text);
    // "@astrojs/cloudflare" import or adapter() call
    hasCloudflareAdapter =
      /@astrojs\/cloudflare/.test(text) || /cloudflare\s*\(/.test(text);
    break; // stop at the first config file found
  }

  const present = missingPeers.length === 0 && hasCmsIntegration && hasCloudflareAdapter;
  return { present, missingPeers, hasCmsIntegration, hasCloudflareAdapter };
}

// ---------------------------------------------------------------------------
// formatWiringGuidance
// ---------------------------------------------------------------------------

/**
 * Format a human-readable guidance block from a WiringReport.
 * Returns null when everything is already wired up (nothing to say).
 *
 * @param {WiringReport} report
 * @returns {string | null}
 */
export function formatWiringGuidance(report) {
  if (report.present) return null;

  const lines = ['⚠ Host wiring needed (one-time):'];
  let step = 1;

  if (report.missingPeers.length > 0) {
    lines.push(`  ${step}) Install peers:  npm i ${report.missingPeers.join(' ')}`);
    step++;
  }

  const needsConfigGuidance = !report.hasCmsIntegration || !report.hasCloudflareAdapter;
  if (needsConfigGuidance) {
    lines.push(`  ${step}) In astro.config.*, add:`);

    const imports = [];
    if (!report.hasCloudflareAdapter) {
      imports.push(`         import cloudflare from '@astrojs/cloudflare';`);
    }
    if (!report.hasCmsIntegration) {
      imports.push(`         import react from '@astrojs/react';`);
      imports.push(`         import cms from 'astro-cloudflare-cms';`);
    }
    lines.push(...imports);

    if (!report.hasCloudflareAdapter && !report.hasCmsIntegration) {
      lines.push(`         export default defineConfig({`);
      lines.push(`           adapter: cloudflare(),`);
      lines.push(`           integrations: [react(), cms()],`);
      lines.push(`           /* keep your existing vite/tailwind config */`);
      lines.push(`         });`);
    } else if (!report.hasCloudflareAdapter) {
      lines.push(`         // Add to your defineConfig:`);
      lines.push(`         adapter: cloudflare(),`);
    } else {
      // hasCloudflareAdapter but missing cms
      lines.push(`         // Add to your integrations array:`);
      lines.push(`         integrations: [react(), cms()],`);
    }
  }

  return lines.join('\n');
}
