import { sanitizeBody } from './sanitize-html-body';
import { resolveMediaHtml } from './media-url';

export function renderBody(html: string, baseUrl?: string): string {
  return resolveMediaHtml(sanitizeBody(html), baseUrl);
}
