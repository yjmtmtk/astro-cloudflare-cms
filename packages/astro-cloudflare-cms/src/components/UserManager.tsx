import { config } from 'virtual:acc-config';
import { useState, useEffect, useCallback } from 'react';
import type { Role } from '../lib/types';
import type { PublicUser } from '../lib/db-users';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from './ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

type FormState = {
  email: string;
  name: string;
  role: Role;
  password: string;
};

const emptyForm = (): FormState => ({ email: '', name: '', role: 'author', password: '' });

export default function UserManager() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${config.adminBasePath}/api/users`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(user: PublicUser) {
    setEditing(user);
    setForm({ email: user.email, name: user.name, role: user.role, password: '' });
    setOpen(true);
  }

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing
        ? `${config.adminBasePath}/api/users/${editing.id}`
        : `${config.adminBasePath}/api/users`;
      const method = editing ? 'PUT' : 'POST';

      const payload: Record<string, string> = {
        name: form.name.trim(),
        role: form.role,
      };
      if (!editing) {
        payload.email = form.email.trim();
      }
      if (form.password) {
        payload.password = form.password;
      }

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
      await fetchUsers();
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: PublicUser) {
    if (!confirm(`「${user.name}」を削除しますか?`)) return;
    try {
      const res = await fetch(`${config.adminBasePath}/api/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function formatDate(unixSec: number) {
    return new Date(unixSec * 1000).toLocaleDateString('ja-JP');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">ユーザー一覧</h2>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          <span>追加</span>
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">読み込み中…</p>}
      {error && <p className="text-sm text-destructive">エラー: {error}</p>}

      {!loading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>メール</TableHead>
              <TableHead>名前</TableHead>
              <TableHead className="w-24">ロール</TableHead>
              <TableHead className="w-32">作成日</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  ユーザーがいません
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>
                  <span className={user.role === 'master' ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                    {user.role}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                <TableCell className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => openEdit(user)} title="編集">
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">編集</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(user)} title="削除">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">削除</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'ユーザーを編集' : 'ユーザーを追加'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            {!editing && (
              <div className="space-y-1">
                <Label htmlFor="user-email">メール *</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                  placeholder="例: user@example.com"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="user-name">名前 *</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="例: 山田太郎"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-role">ロール</Label>
              <select
                id="user-role"
                value={form.role}
                onChange={(e) => handleChange('role', e.target.value as Role)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="author">author</option>
                <option value="master">master</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-password">
                {editing ? 'パスワード（変更する場合のみ）' : 'パスワード *'}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required={!editing}
                placeholder="8文字以上"
                minLength={form.password.length > 0 ? 8 : undefined}
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
