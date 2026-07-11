'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { Info, Plus } from 'lucide-react';
import { useState } from 'react';

function isOverdue(reviewDueAt: string | null | undefined): boolean {
  return !!reviewDueAt && new Date(reviewDueAt) <= new Date();
}

function statusTone(status: string, overdue: boolean): string {
  if (status === 'ACTIVE' && !overdue) return 'completed';
  if (overdue || status === 'OUTDATED') return 'cancelled';
  return 'pending';
}

function shortSource(src: string | null | undefined): string {
  if (!src) return '—';
  return src.length > 42 ? `${src.slice(0, 42)}…` : src;
}

export default function PlatformPacksPage() {
  const packs = useApi<{ data: any[] }>('/compliance/platform-packs');
  const { canManage } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const doAction = async (id: string, fn: () => Promise<any>, okMsg: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      await fn();
      packs.reload();
      setMsg({ tone: 'ok', text: okMsg });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Thao tác thất bại' });
    } finally {
      setBusyId(null);
    }
  };

  const rows = packs.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Policy"
        title="Platform packs"
        description="Chính sách từng nền tảng theo phiên bản. Khi quá hạn rà soát, hệ thống tự tắt auto-publish."
        action={
          canManage ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Thêm pack
            </Button>
          ) : undefined
        }
      />

      {msg && (
        <div
          className={
            msg.tone === 'ok'
              ? 'rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700'
              : 'rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700'
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Không tự đánh dấu “đã xác minh” nếu chưa có người rà soát nguồn chính thức.</span>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Danh mục platform packs</h2>
          {packs.loading ? (
            <LoadingState />
          ) : packs.error ? (
            <ErrorState message={packs.error} onRetry={packs.reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="Chưa có platform pack" hint={canManage ? 'Nhấn “Thêm pack”' : undefined} />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3 font-semibold">Nền tảng</th>
                    <th className="px-4 py-3 font-semibold">Phiên bản</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold">Rà soát</th>
                    <th className="px-4 py-3 font-semibold">Nguồn</th>
                    <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const overdue = isOverdue(p.reviewDueAt);
                    return (
                      <tr key={p.id} className="border-b border-ink-100/70 last:border-0">
                        <td className="px-4 py-3 font-medium text-ink-900">{p.platform}</td>
                        <td className="px-4 py-3 text-ink-600">{p.version}</td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(p.status, overdue)}>{p.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-500">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {p.reviewDueAt ? formatDate(p.reviewDueAt) : '—'}
                            {overdue && <Badge tone="cancelled">QUÁ HẠN</Badge>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-500">{shortSource(p.officialSource)}</td>
                        <td className="px-4 py-3">
                          {canManage ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {p.status !== 'ACTIVE' && (
                                <Button
                                  size="sm"
                                  loading={busyId === p.id}
                                  onClick={() => doAction(p.id, () => api.patch(`/compliance/platform-packs/${p.id}/status`, { status: 'ACTIVE' }), 'Đã kích hoạt pack.')}
                                >
                                  Kích hoạt
                                </Button>
                              )}
                              {(overdue || p.status === 'ACTIVE') && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busyId === p.id}
                                  onClick={() => doAction(p.id, () => api.patch(`/compliance/platform-packs/${p.id}/status`, { status: 'OUTDATED' }), 'Đã đánh dấu hết hạn.')}
                                >
                                  Đánh dấu hết hạn
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-ink-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {showCreate && canManage && (
        <CreatePackModal onClose={() => setShowCreate(false)} onCreated={() => packs.reload()} />
      )}
    </div>
  );
}

function CreatePackModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    platform: '',
    reviewDueAt: '',
    officialSource: '',
    sourceReference: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post('/compliance/platform-packs', form);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thể tạo pack');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Thêm platform pack</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="platform">Nền tảng</Label>
              <Input id="platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="reviewDueAt">Hạn rà soát</Label>
              <Input id="reviewDueAt" type="date" value={form.reviewDueAt} onChange={(e) => setForm({ ...form, reviewDueAt: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="officialSource">Nguồn chính thức</Label>
              <Input id="officialSource" value={form.officialSource} onChange={(e) => setForm({ ...form, officialSource: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sourceReference">Tham chiếu nguồn</Label>
              <Input id="sourceReference" value={form.sourceReference} onChange={(e) => setForm({ ...form, sourceReference: e.target.value })} />
            </div>
            {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Tạo
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
