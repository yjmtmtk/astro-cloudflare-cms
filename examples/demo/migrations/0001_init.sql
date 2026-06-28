-- D1 foreign-key behavior (Cloudflare D1 enforces FKs by default, equivalent to
-- PRAGMA foreign_keys = ON; the pragma cannot be disabled and runs in implicit transactions):
--
-- sessions.user_id ON DELETE CASCADE  → deleting a user auto-removes all their sessions.
-- articles.category_id ON DELETE SET NULL → deleting a category nulls articles' category_id.
-- articles.author_id REFERENCES users(id)  — NO ON DELETE action — deleting a user who
--   authored articles WILL FAIL with an FK violation; the user-management flow (a later plan)
--   must reassign or remove those articles first, or block the delete entirely.
-- media.article_id  — intentionally has NO foreign key — media rows are created at upload time
--   before a new article row exists; referential integrity is handled by application-level
--   orphan GC (a later plan). Do NOT add an FK here.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('master','author')),
  name          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE articles (
  id           TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  excerpt      TEXT,
  eyecatch_url TEXT,
  category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  author_id    TEXT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL CHECK (status IN ('published','hidden')),
  publish_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_articles_visibility ON articles(status, publish_at);
CREATE INDEX idx_articles_author ON articles(author_id);
CREATE INDEX idx_articles_category ON articles(category_id);

CREATE TABLE media (
  id         TEXT PRIMARY KEY,
  r2_key     TEXT UNIQUE NOT NULL,
  url        TEXT NOT NULL,
  article_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_media_article ON media(article_id);
