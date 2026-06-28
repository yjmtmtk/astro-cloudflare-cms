import type { SessionUser, ArticleRow } from './types';

export function isMaster(user: SessionUser | null): boolean {
  return user?.role === 'master';
}

export function canCreateArticle(user: SessionUser | null): boolean {
  return user !== null;
}

export function canManageArticle(
  user: SessionUser | null,
  article: Pick<ArticleRow, 'author_id'>
): boolean {
  if (!user) return false;
  return user.role === 'master' || user.id === article.author_id;
}
