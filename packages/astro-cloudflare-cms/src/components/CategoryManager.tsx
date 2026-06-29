import { config } from 'virtual:acc-config';
import { useState, useEffect, useCallback } from 'react';
import type { CategoryRow } from '../lib/types';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from './ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import Pager from './Pager';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

const PAGE_SIZE = 20;

type FormState = { name: string; slug: string; sort_order: string };

const emptyForm = (): FormState => ({ name: '', slug: '', sort_order: '0' });

export default function CategoryManager() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`${config.adminBasePath}/api/categories?` + params, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { items: CategoryRow[]; total: number };
      setCategories(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(cat: CategoryRow) {
    setEditing(cat);
    setForm({ name: cat.name, slug: cat.slug, sort_order: String(cat.sort_order) });
    setOpen(true);
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        sort_order: form.sort_order !== '' && form.sort_order != null ? Number(form.sort_order) : undefined,
      };
      const url = editing
        ? `${config.adminBasePath}/api/categories/${editing.id}`
        : `${config.adminBasePath}/api/categories`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await fetchCategories();
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: CategoryRow) {
    if (!confirm(`「${cat.name}」を削除しますか?`)) return;
    try {
      const res = await fetch(`${config.adminBasePath}/api/categories/${cat.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">カテゴリ一覧</h2>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          <span>追加</span>
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">読み込み中…</p>}
      {error && <p className="text-sm text-destructive">エラー: {error}</p>}

      {!loading && !error && (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="text-xs text-muted-foreground">
              <TableHead>名前</TableHead>
              <TableHead>スラッグ</TableHead>
              <TableHead className="w-16">順序</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  カテゴリがありません
                </TableCell>
              </TableRow>
            )}
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">
                  <div className="truncate" title={cat.name}>{cat.name}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div className="truncate" title={cat.slug}>{cat.slug}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{cat.sort_order}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(cat)}
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">編集</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(cat)}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">削除</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && !error && (
        <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'カテゴリを編集' : 'カテゴリを追加'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cat-name">名前 *</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="例: ニュース"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-slug">スラッグ（省略可）</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                placeholder="例: news（省略時は名前から自動生成）"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-order">表示順序</Label>
              <Input
                id="cat-order"
                type="number"
                value={form.sort_order}
                onChange={(e) => handleChange('sort_order', e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button size="sm" type="button" variant="outline" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
                <span>キャンセル</span>
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                <span>{saving ? '保存中…' : '保存'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
