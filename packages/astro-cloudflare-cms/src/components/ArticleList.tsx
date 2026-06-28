import { config } from 'virtual:acc-config';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { CategoryRow } from '../lib/types';
import type { ArticleListItem } from '../lib/db-articles';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { Trash2 } from 'lucide-react';

interface Props {
  isMaster: boolean;
}

function formatPublishDate(publish_at: number): { label: string; reserved: boolean } {
  const ms = publish_at * 1000;
  // Compact: short date + HH:MM (drop seconds)
  const label = new Date(ms).toLocaleString('ja-JP', {
    year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const reserved = ms > Date.now();
  return { label, reserved };
}

export default function ArticleList({ isMaster }: Props) {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');

  // 300ms debounce for title search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(value);
    }, 300);
  }

  // Fetch categories (master only)
  useEffect(() => {
    if (!isMaster) return;
    fetch(`${config.adminBasePath}/api/categories`, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CategoryRow[]>;
      })
      .then(setCategories)
      .catch(() => {
        // Non-fatal — category filter just won't populate
      });
  }, [isMaster]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (isMaster && categoryFilter !== 'all') params.set('category', categoryFilter);
      if (q) params.set('q', q);
      const res = await fetch(
        `${config.adminBasePath}/api/articles` + (params.toString() ? '?' + params.toString() : ''),
        { credentials: 'same-origin' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setArticles(await res.json() as ArticleListItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, q, isMaster]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  async function handleDelete(article: ArticleListItem) {
    if (!confirm(`「${article.title}」を削除しますか?`)) return;
    try {
      const res = await fetch(`${config.adminBasePath}/api/articles/${article.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchArticles();
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="published">公開</SelectItem>
            <SelectItem value="hidden">非公開</SelectItem>
          </SelectContent>
        </Select>

        {isMaster && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="カテゴリ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          className="w-56"
          placeholder="タイトル検索…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">読み込み中…</p>}
      {error && <p className="text-sm text-destructive">エラー: {error}</p>}

      {!loading && !error && (
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="text-xs text-muted-foreground">
              <TableHead>タイトル</TableHead>
              <TableHead className="w-16">状態</TableHead>
              <TableHead className="w-24">カテゴリ</TableHead>
              <TableHead className="w-28">公開</TableHead>
              {isMaster && <TableHead className="w-24">著者</TableHead>}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 && (
              <TableRow>
                <TableCell colSpan={isMaster ? 6 : 5} className="text-center text-muted-foreground">
                  記事がありません
                </TableCell>
              </TableRow>
            )}
            {articles.map((article) => {
              const { label, reserved } = formatPublishDate(article.publish_at);
              return (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`${config.adminBasePath}/articles/${article.id}`}
                      className="block truncate underline hover:text-primary"
                      title={article.title}
                    >
                      {article.title}
                    </a>
                  </TableCell>
                  <TableCell>
                    <span
                      title={article.status === 'published' ? '公開' : '非公開'}
                      className={
                        'inline-flex items-center gap-1 text-xs ' +
                        (article.status === 'published' ? 'text-foreground' : 'text-muted-foreground')
                      }
                    >
                      <span
                        className={
                          'h-1.5 w-1.5 rounded-full ' +
                          (article.status === 'published' ? 'bg-emerald-500' : 'bg-muted-foreground/50')
                        }
                      />
                      {article.status === 'published' ? '公開' : '下書'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="truncate" title={article.category_name ?? undefined}>
                      {article.category_name ?? '—'}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {label}
                    {reserved && <span className="ml-1 text-amber-600 font-medium">予約</span>}
                  </TableCell>
                  {isMaster && (
                    <TableCell className="text-muted-foreground text-xs">
                      <div className="truncate" title={article.author_name ?? undefined}>
                        {article.author_name ?? '—'}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(article)}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">削除</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
