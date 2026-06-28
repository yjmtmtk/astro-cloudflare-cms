import { customAlphabet } from 'nanoid';

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ensureSlug(desired: string | null | undefined): string {
  const s = desired ? slugify(desired) : '';
  return s.length > 0 ? s : nano();
}
