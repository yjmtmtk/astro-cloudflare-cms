// Shared pagination helpers for admin list endpoints.
//
// Endpoints stay backward-compatible: when no `page` query param is present
// parsePage returns null and the caller returns a bare array (used by the
// category/select dropdowns that need the full list). When `page` is present
// the caller returns a Paginated envelope instead.

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePage(url: URL, defaultSize = DEFAULT_PAGE_SIZE): PageParams | null {
  const raw = url.searchParams.get('page');
  if (raw === null) return null;
  const page = Math.max(1, Math.floor(Number(raw)) || 1);
  const sizeRaw = Math.floor(Number(url.searchParams.get('pageSize')));
  const pageSize =
    Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.min(MAX_PAGE_SIZE, sizeRaw) : defaultSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}
