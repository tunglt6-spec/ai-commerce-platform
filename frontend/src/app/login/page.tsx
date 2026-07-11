'use client';

import { Button, Card, CardBody, Input, Label } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, accessToken, hydrated } = useAuth();
  const [email, setEmail] = useState('admin@commerce.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && accessToken) router.replace('/dashboard');
  }, [hydrated, accessToken, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password }, false);
      setAuth({
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
        user: res.data.user,
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-ink-900">AI Commerce Platform</h1>
          <p className="text-sm text-ink-500">Đăng nhập vào bảng điều khiển</p>
        </div>
        <Card>
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full">
                Đăng nhập
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-4 text-center text-xs text-ink-400">
          Dùng tài khoản seed mặc định: admin@commerce.local
        </p>
      </div>
    </div>
  );
}
