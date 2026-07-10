'use client';

import { Button, Card, CardBody, Input, Label } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, clear } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.next !== form.confirm) {
      setError('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current,
        new_password: form.next,
      });
      setDone(true);
      // Tokens are revoked server-side — sign out and return to login.
      setTimeout(() => {
        clear();
        router.replace('/login');
      }, 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Cài đặt</h1>
        <p className="text-sm text-gray-500">Tài khoản: {user?.email}</p>
      </div>

      <Card className="max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-gray-800">Đổi mật khẩu</h2>
          {done ? (
            <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
              Đổi mật khẩu thành công. Đang đăng xuất để đăng nhập lại…
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="cur">Mật khẩu hiện tại</Label>
                <Input
                  id="cur"
                  type="password"
                  autoComplete="current-password"
                  value={form.current}
                  onChange={(e) => setForm({ ...form, current: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="new">Mật khẩu mới</Label>
                <Input
                  id="new"
                  type="password"
                  autoComplete="new-password"
                  value={form.next}
                  onChange={(e) => setForm({ ...form, next: e.target.value })}
                  required
                />
                <p className="mt-1 text-xs text-gray-400">
                  Tối thiểu 8 ký tự, gồm chữ hoa, số và ký tự đặc biệt.
                </p>
              </div>
              <div>
                <Label htmlFor="cf">Xác nhận mật khẩu mới</Label>
                <Input
                  id="cf"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" loading={saving}>
                Đổi mật khẩu
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
