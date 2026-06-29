// Pure helpers + side-effecting scaffoldNews for the init flow.
//
// Pure helpers (importable in tests without node:child_process side effects):
//   renderScaffoldPage(template, layoutImport)  → string
//   sourceDirectiveFor()                        → string
//   resolveLayoutImport(pageDir, layoutPath)    → string
//
// Side-effecting:
//   scaffoldNews({ cwd, layout, force })        → void (writes files, appends @source)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Replace every occurrence of the `__LAYOUT_IMPORT__` token in a template
 * with the resolved layout import path.
 *
 * @param {string} template  - Raw template content with `__LAYOUT_IMPORT__` tokens.
 * @param {string} layoutImport - The relative (or absolute) import path to substitute.
 * @returns {string}
 */
export function renderScaffoldPage(template, layoutImport) {
  return template.replaceAll('__LAYOUT_IMPORT__', layoutImport);
}

/**
 * Compute the relative import path from a page directory to the host layout file.
 *
 * @param {string} pageDir    - Absolute path to the directory where the page will live,
 *                              e.g. `<cwd>/src/pages/news`.
 * @param {string} layoutPath - Path to the layout, relative to the host project root
 *                              (e.g. `src/layouts/Layout.astro`) or absolute.
 * @returns {string} A relative path suitable for use as an import specifier.
 */
export function resolveLayoutImport(pageDir, layoutPath) {
  // layoutPath may be absolute or relative-to-cwd; we need it relative to pageDir.
  // Resolve cwd from pageDir: pageDir is typically <cwd>/src/pages/news.
  // If layoutPath is already absolute, use it directly; otherwise resolve from
  // the project root (two levels up from pageDir: news → pages → src → cwd).
  let absoluteLayout;
  if (layoutPath.startsWith('/')) {
    absoluteLayout = layoutPath;
  } else {
    // Assume project root is 3 dirs up: news/ → pages/ → src/ → cwd/
    const cwd = dirname(dirname(dirname(pageDir)));
    absoluteLayout = resolve(cwd, layoutPath);
  }
  const rel = relative(pageDir, absoluteLayout);
  // Ensure starts with ./ or ../
  return rel.startsWith('.') ? rel : './' + rel;
}

/**
 * Return the Tailwind CSS `@source` directive line that points at the package's
 * news component directory.
 *
 * The path is relative to the typical host `src/styles/global.css` location:
 *   src/styles/ → ../../node_modules/astro-cloudflare-cms/src/news
 *
 * Assumption: host CSS lives at `<cwd>/src/styles/global.css`.
 * If the host uses a different CSS location this line can be added manually.
 *
 * @returns {string} e.g. `@source "../../node_modules/astro-cloudflare-cms/src/news";`
 */
export function sourceDirectiveFor() {
  return '@source "../../node_modules/astro-cloudflare-cms/src/news";';
}

// ---------------------------------------------------------------------------
// Side-effecting orchestration
// ---------------------------------------------------------------------------

/**
 * Scaffold the two thin /news page templates into the host project.
 *
 * @param {{ cwd: string, layout?: string, force?: boolean }} opts
 */
export async function scaffoldNews({ cwd, layout, force = false }) {
  const resolvedLayout = layout ?? 'src/layouts/Layout.astro';
  const newsPageDir = resolve(cwd, 'src', 'pages', 'news');

  // Ensure directory exists
  if (!existsSync(newsPageDir)) {
    mkdirSync(newsPageDir, { recursive: true });
  }

  // Compute the relative layout import path from the news page dir
  const layoutImport = resolveLayoutImport(newsPageDir, resolvedLayout);

  const templateFiles = ['index.astro', '[slug].astro'];
  const written = [];
  const skipped = [];

  for (const fname of templateFiles) {
    const dest = resolve(newsPageDir, fname);
    if (existsSync(dest) && !force) {
      skipped.push(dest);
      continue;
    }

    // Load template from within this package
    const templateUrl = new URL(`../scaffold/news/${fname}`, import.meta.url);
    const template = readFileSync(templateUrl, 'utf8');
    const rendered = renderScaffoldPage(template, layoutImport);
    writeFileSync(dest, rendered, 'utf8');
    written.push(dest);
  }

  // Append @source line to global.css if not already present
  const globalCss = resolve(cwd, 'src', 'styles', 'global.css');
  const sourceLine = sourceDirectiveFor();

  if (existsSync(globalCss)) {
    const existing = readFileSync(globalCss, 'utf8');
    if (!existing.includes('astro-cloudflare-cms/src/news')) {
      const sep = existing.endsWith('\n') || existing === '' ? '' : '\n';
      writeFileSync(globalCss, existing + sep + sourceLine + '\n', 'utf8');
      console.log(`  Appended @source directive to ${globalCss}`);
    } else {
      console.log(`  @source directive already present in ${globalCss}; skipping.`);
    }
  } else {
    console.log(`  ${globalCss} not found; skipping @source injection. Add manually:`);
    console.log(`    ${sourceLine}`);
  }

  return { written, skipped };
}
