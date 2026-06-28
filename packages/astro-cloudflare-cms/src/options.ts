export interface CmsOptions {
  adminBasePath?: string;
  newsBasePath?: string;
  mediaBasePath?: string;
  brand?: string;
  defaultEyecatchUrl?: string;
}

export interface ResolvedCmsOptions {
  adminBasePath: string;
  newsBasePath: string;
  mediaBasePath: string;
  brand: string;
  defaultEyecatchUrl: string;
}

function normalizePath(p: string): string {
  return '/' + p.replace(/^\/+|\/+$/g, '');
}

export function resolveOptions(o: CmsOptions = {}): ResolvedCmsOptions {
  return {
    adminBasePath: normalizePath(o.adminBasePath ?? '/admin'),
    newsBasePath: normalizePath(o.newsBasePath ?? '/news'),
    mediaBasePath: normalizePath(o.mediaBasePath ?? '/cms-media'),
    brand: o.brand ?? 'astro-cloudflare-cms',
    defaultEyecatchUrl: o.defaultEyecatchUrl ?? '',
  };
}
