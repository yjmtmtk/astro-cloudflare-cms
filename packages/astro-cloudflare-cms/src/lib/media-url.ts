export function cmsMediaPath(r2Key: string): string {
  return `/cms-media/${r2Key}`;
}

export function mediaUrl(r2Key: string, baseUrl?: string): string {
  if (baseUrl && baseUrl.length > 0) {
    return `${baseUrl.replace(/\/+$/, '')}/${r2Key}`;
  }
  return cmsMediaPath(r2Key);
}

export function resolveMediaHtml(html: string, baseUrl?: string): string {
  if (!baseUrl || baseUrl.length === 0) return html;
  const base = baseUrl.replace(/\/+$/, '');
  return html.split('/cms-media/').join(`${base}/`);
}
