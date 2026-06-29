import { config } from 'virtual:acc-config';
import { useState, useRef, useEffect } from 'react';
import type { ArticleRow } from '../lib/types';
import RichTextEditor from './RichTextEditor';
import CategorySelect from './CategorySelect';
import EyecatchField from './EyecatchField';
import { Save, Eye } from 'lucide-react';

function toLocalInput(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

function fromLocalInput(str: string): number {
  return Math.floor(new Date(str).getTime() / 1000);
}

export default function ArticleForm({
  mode,
  initial,
}: {
  mode: 'new' | 'edit';
  initial?: ArticleRow;
}) {
  // Stable draft id: for new articles generate once; for edit use existing id.
  const articleIdRef = useRef<string>(
    mode === 'new' ? crypto.randomUUID() : (initial?.id ?? crypto.randomUUID())
  );
  const articleId = articleIdRef.current;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [status, setStatus] = useState<'published' | 'hidden'>(initial?.status ?? 'hidden');
  // For new articles, start with null and set "now" client-only via useEffect
  // to avoid React #418 SSR/client hydration mismatch (Date.now() differs).
  // For edit mode, use the article's existing publish_at.
  const [publishAt, setPublishAt] = useState<number | null>(
    initial?.publish_at ?? null
  );

  useEffect(() => {
    // Only set the default for new articles where no value has been loaded.
    if (publishAt === null) {
      setPublishAt(Math.floor(Date.now() / 1000));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [body, setBody] = useState(initial?.body ?? '');
  const [eyecatchUrl, setEyecatchUrl] = useState<string | null>(
    initial?.eyecatch_url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      title,
      body,
      status,
      category_id: categoryId,
      publish_at: publishAt ?? Math.floor(Date.now() / 1000),
      eyecatch_url: eyecatchUrl,
    };
    if (slug.trim()) payload.slug = slug.trim();
    if (mode === 'new') payload.id = articleId;

    const url =
      mode === 'new'
        ? `${config.adminBasePath}/api/articles`
        : `${config.adminBasePath}/api/articles/${initial!.id}`;
    const method = mode === 'new' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        window.location.href = `${config.adminBasePath}`;
        return;
      }

      const text = await res.text();
      setError(text || `Error ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Main column: title + body */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base font-medium"
              placeholder="記事タイトル"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">本文</label>
            <RichTextEditor value={body} onChange={setBody} articleId={articleId} />
          </div>
        </div>

        {/* Sidebar: publish settings + actions */}
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-80">
          <div className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground">
            <h2 className="text-sm font-semibold">公開設定</h2>

            {/* Status */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">ステータス</label>
              <button
                type="button"
                onClick={() =>
                  setStatus((s) => (s === 'published' ? 'hidden' : 'published'))
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  status === 'published'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'published' ? '公開中' : '非公開'}
              </button>
            </div>

            {/* Publish At */}
            <div className="space-y-1">
              <label className="text-sm font-medium">公開日時</label>
              <input
                type="datetime-local"
                value={publishAt !== null ? toLocalInput(publishAt) : ''}
                onChange={(e) => setPublishAt(fromLocalInput(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1">
              <label className="text-sm font-medium">スラッグ（省略可）</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                placeholder="省略時は自動生成"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-sm font-medium">カテゴリ</label>
              <CategorySelect value={categoryId} onChange={setCategoryId} />
            </div>

            {/* Eyecatch */}
            <div className="space-y-1">
              <label className="text-sm font-medium">アイキャッチ画像</label>
              <EyecatchField
                articleId={articleId}
                value={eyecatchUrl}
                onChange={setEyecatchUrl}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中…' : '保存'}
            </button>
            <div className="flex gap-2">
              <a
                href={`${config.adminBasePath}`}
                className="flex-1 rounded-md border px-4 py-1.5 text-center text-sm font-medium hover:bg-muted"
              >
                キャンセル
              </a>
              {mode === 'edit' && initial?.slug && (
                <a
                  href={`${config.newsBasePath}/${initial.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-4 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  <Eye className="h-4 w-4" />
                  プレビュー
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
