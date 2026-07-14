'use client';

import { Badge, Button, Card, CardBody, ErrorState, Input, Label, LoadingState, PageHeader, StatCard } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { CheckCircle2, Mail, SendHorizontal, Server, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface EmailStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  smtp_host: string | null;
  smtp_port: number | null;
  from_email: string | null;
  from_name: string | null;
  last_error: string | null;
}

export default function EmailIntegrationPage() {
  const { canManage } = usePermissions();
  const isAdmin = usePermissions().role === 'admin';
  const { data, loading, error, reload } = useApi<{ data: EmailStatus }>('/integrations/email/status');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: '465',
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
  });
  const [testTo, setTestTo] = useState('');

  const connect = async () => {
    if (!form.smtp_host || !form.smtp_user || !form.smtp_password || !form.from_email) {
      setMsg({ tone: 'err', text: 'Nhập đủ SMTP host, user, password và email gửi (from).' });
      return;
    }
    setBusy('connect');
    setMsg(null);
    try {
      await api.post('/integrations/email/connect', {
        smtp_host: form.smtp_host,
        smtp_port: Number(form.smtp_port) || 465,
        smtp_secure: form.smtp_secure,
        smtp_user: form.smtp_user,
        smtp_password: form.smtp_password,
        from_email: form.from_email,
        from_name: form.from_name || undefined,
      });
      setMsg({ tone: 'ok', text: 'Đã lưu cấu hình SMTP. Bấm "Gửi email test" để xác minh.' });
      setForm((f) => ({ ...f, smtp_password: '' }));
      reload();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Lưu cấu hình thất bại' });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setMsg(null);
    try {
      const res = await api.post('/integrations/email/test', testTo ? { to: testTo } : {});
      setMsg({ tone: 'ok', text: `Đã gửi email test tới ${res.data.sent_to}. Kiểm tra hộp thư (kể cả Spam).` });
      reload();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Gửi test thất bại' });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Ngắt kết nối Email? Mật khẩu SMTP đã lưu sẽ bị xoá.')) return;
    setBusy('disconnect');
    try {
      await api.post('/integrations/email/disconnect');
      setMsg({ tone: 'ok', text: 'Đã ngắt kết nối Email.' });
      reload();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Ngắt kết nối thất bại' });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data!.data;

  return (
    <div className="space-y-6">
      <Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        ← Tích hợp
      </Link>
      <PageHeader
        eyebrow="Messaging"
        title="Email (SMTP)"
        description="Gửi email giao dịch & thông báo qua SMTP của bạn (vd Gmail App Password, SendGrid, Brevo). Khoá được mã hoá khi lưu."
        action={<Mail className="h-6 w-6 text-white" />}
      />

      {msg && (
        <div className={(msg.tone === 'ok' ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-700') + ' rounded-2xl px-4 py-3 text-sm'}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={s.connected ? CheckCircle2 : XCircle} label="Trạng thái" value={s.connected ? 'Đã kết nối' : s.configured ? 'Chưa test' : 'Chưa cấu hình'} tone={s.connected ? 'brand' : 'amber'} />
        <StatCard icon={Server} label="SMTP host" value={s.smtp_host ?? '—'} />
        <StatCard icon={Mail} label="Gửi từ" value={s.from_email ?? '—'} tone="blue" />
      </div>

      {s.last_error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Lỗi gần nhất: {s.last_error}</div>}

      {!isAdmin && !s.configured && (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-600">Cần quyền Admin để cấu hình SMTP.</p>
          </CardBody>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                <Server className="h-4 w-4 text-brand-600" /> Cấu hình SMTP
              </h2>
              <p className="text-sm text-ink-500">Gmail: host <code className="rounded bg-ink-100 px-1">smtp.gmail.com</code>, port 465, dùng App Password (bật 2FA).</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="host">SMTP host</Label>
                <Input id="host" value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input id="port" type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: e.target.value })} placeholder="465" />
              </div>
              <div>
                <Label htmlFor="user">SMTP user</Label>
                <Input id="user" value={form.smtp_user} onChange={(e) => setForm({ ...form, smtp_user: e.target.value })} placeholder="you@gmail.com" />
              </div>
              <div>
                <Label htmlFor="pass">SMTP password / App Password</Label>
                <Input id="pass" type="password" value={form.smtp_password} onChange={(e) => setForm({ ...form, smtp_password: e.target.value })} placeholder="••••••••" />
              </div>
              <div>
                <Label htmlFor="fromEmail">Email gửi (from)</Label>
                <Input id="fromEmail" type="email" value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} placeholder="you@gmail.com" />
              </div>
              <div>
                <Label htmlFor="fromName">Tên hiển thị (tuỳ chọn)</Label>
                <Input id="fromName" value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} placeholder="Cửa hàng của tôi" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={form.smtp_secure} onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })} className="h-4 w-4 rounded border-ink-300 text-brand-600" />
              TLS ngầm định (secure) — bật cho port 465, tắt cho 587 (STARTTLS)
            </label>
            <div className="flex justify-end">
              <Button loading={busy === 'connect'} onClick={connect}>
                Lưu cấu hình
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {s.configured && (
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                <SendHorizontal className="h-4 w-4 text-brand-600" /> Gửi email test
              </h2>
              <p className="text-sm text-ink-500">Gửi 1 email thật để xác minh cấu hình. Bỏ trống để gửi về chính địa chỉ gửi (from).</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="to">Gửi tới (tuỳ chọn)</Label>
                <Input id="to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={s.from_email ?? 'email@nhan.com'} />
              </div>
              <Button loading={busy === 'test'} disabled={!canManage} onClick={test}>
                <SendHorizontal className="h-4 w-4" /> Gửi email test
              </Button>
              {isAdmin && (
                <Button variant="danger" loading={busy === 'disconnect'} onClick={disconnect}>
                  Ngắt
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
