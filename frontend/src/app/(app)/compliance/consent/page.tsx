'use client';

import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface Consent {
  id: string;
  customerId: string;
  channel: string;
  purpose: string;
  status: string;
  capturedAt: string;
  withdrawnAt?: string;
  expiresAt?: string;
}

const CHANNELS = ['EMAIL', 'SMS', 'PHONE', 'ZALO', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WEBSITE', 'CHATBOT', 'PUSH', 'OTHER'];
const PURPOSES = ['TRANSACTIONAL', 'CUSTOMER_SUPPORT', 'MARKETING', 'PERSONALIZATION', 'ANALYTICS', 'LOYALTY', 'REMARKETING'];

const SELECT_CLASS =
  'h-10 w-full rounded-xl border border-ink-200 bg-white/85 px-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

function statusTone(status: string) {
  if (status === 'GRANTED') return 'completed';
  if (status === 'WITHDRAWN') return 'cancelled';
  return 'pending';
}

export default function ConsentPage() {
  const { canManage, canOperate } = usePermissions();
  const { data, loading, error, reload } = useApi<{ data: Consent[] }>('/compliance/consent?limit=100');
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', channel: 'EMAIL', purpose: 'MARKETING', source: '' });

  const openCreate = () => {
    setForm({ customerId: '', channel: 'EMAIL', purpose: 'MARKETING', source: '' });
    setErr(null);
    setOpen(true);
  };

  const withdraw = async (id: string) => {
    setBusy(id);
    setOk(null);
    setErr(null);
    try {
      await api.patch(`/compliance/consent/${id}/withdraw`);
      setOk('Đã rút consent của khách hàng.');
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Rút consent thất bại');
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!form.customerId.trim()) {
      setErr('Vui lòng nhập Customer ID (UUID).');
      return;
    }
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      await api.post('/compliance/consent', form);
      setOk('Đã ghi nhận consent mới.');
      setOpen(false);
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Ghi nhận consent thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data & Consent"
        title="Consent"
        description="Cơ sở liên hệ khách hàng theo kênh và mục đích — điều kiện bắt buộc trước khi gửi marketing."
        action={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Ghi nhận consent
            </Button>
          ) : undefined
        }
      />

      {ok && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{ok}</div>}
      {err && !open && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (data!.data?.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có consent nào được ghi nhận" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Khách hàng</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Kênh</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Mục đích</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Ghi nhận</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((c) => (
                  <tr key={c.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-ink-700">{c.customerId?.slice(0, 8) || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge>{c.channel}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">{c.purpose}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{formatDate(c.capturedAt)}</td>
                    <td className="px-5 py-3.5">
                      {canOperate && c.status === 'GRANTED' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busy === c.id}
                          disabled={busy === c.id}
                          onClick={() => withdraw(c.id)}
                        >
                          Rút consent
                        </Button>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => !saving && setOpen(false)} />
          <Card className="relative z-10 w-full max-w-lg">
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Ghi nhận consent</h2>
                <p className="mt-1 text-sm text-ink-500">Đăng ký cơ sở liên hệ hợp lệ cho một khách hàng.</p>
              </div>

              {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

              <div>
                <Label htmlFor="customerId">Customer ID (UUID)</Label>
                <Input
                  id="customerId"
                  required
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="channel">Kênh</Label>
                <select
                  id="channel"
                  className={SELECT_CLASS}
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="purpose">Mục đích</Label>
                <select
                  id="purpose"
                  className={SELECT_CLASS}
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                >
                  {PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="source">Nguồn (tuỳ chọn)</Label>
                <Input
                  id="source"
                  placeholder="Ví dụ: form đăng ký website"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                  Huỷ
                </Button>
                <Button onClick={submit} loading={saving} disabled={saving || !canOperate}>
                  Ghi nhận
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!canManage && <p className="text-xs text-ink-400">Chỉ Manager trở lên mới ghi nhận consent được.</p>}
    </div>
  );
}
