import { resolveMediaHtml } from './media-url';

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function generatePlaceholder(seed: { title: string; categoryId?: string | null }): string {
  const key = `${seed.title}|${seed.categoryId ?? ''}`;
  const hue = hashHue(key);
  const initial = (seed.title.trim()[0] ?? '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue},65%,55%)"/>` +
    `<stop offset="100%" stop-color="hsl(${(hue + 40) % 360},65%,40%)"/></linearGradient></defs>` +
    `<rect width="1280" height="720" fill="url(#g)"/>` +
    `<text x="640" y="400" font-size="320" font-family="sans-serif" fill="rgba(255,255,255,0.85)" ` +
    `text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function eyecatchOf(
  article: { title: string; eyecatch_url: string | null; category_id: string | null },
  opts: { baseUrl?: string; defaultUrl?: string }
): string {
  if (article.eyecatch_url) return resolveMediaHtml(article.eyecatch_url, opts.baseUrl);
  if (opts.defaultUrl && opts.defaultUrl.length > 0) return opts.defaultUrl;
  return generatePlaceholder({ title: article.title, categoryId: article.category_id });
}
