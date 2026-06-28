export type Role = 'master' | 'author';
export type ArticleStatus = 'published' | 'hidden';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: Role;
  name: string;
  created_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  created_at: number;
}

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  excerpt: string | null;
  eyecatch_url: string | null;
  category_id: string | null;
  author_id: string;
  status: ArticleStatus;
  publish_at: number;
  created_at: number;
  updated_at: number;
}

export interface MediaRow {
  id: string;
  r2_key: string;
  url: string;
  article_id: string;
  created_at: number;
}

/** The session-resolved user exposed on Astro.locals (no secrets). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
