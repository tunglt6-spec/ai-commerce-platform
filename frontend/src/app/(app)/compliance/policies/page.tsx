'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { Info, Plus } from 'lucide-react';
import { useState } from 'react';

const POLICY_TYPES = [
  'LEGAL',
  'PLATFORM',
  'PRODUCT',
  'DATA_PRIVACY',
  'CONSENT',
  'MARKETING',
  'CONTENT',
  'ADVERTISING',
  'INTELLECTUAL_PROPERTY',
  'CONSUMER_PROTECTION',
  'AGENT_PERMISSION',
  'EXECUTION',
  'SECURITY',
  'RETENTION',
];

const ENFORCEMENT_MODES = ['ADVISORY', 'WARN', 'REQUIRE_APPROVAL', 'BLOCK'];

const SELECT_CLASS =
  'h-10 w-full rounded-xl border border-ink-200 bg-white/85 px-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

function statusTone(status: string): string {
  if (status === 'ACTIVE') return 'completed';
  if (status === 'DRAFT' || status === 'UNDER_REVIEW') return 'pending';
  return 'cancelled';
}

export default function PoliciesPage() {
  const policies = useApi<{ data: any[] }>('/compliance/policies?limit=100');
  const { canManage } = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const doAction = async (id: string, fn: () => Promise<any>, okMsg: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      await fn();
      policies.reload();
      setMsg({ tone: 'ok', text: okMsg });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Thao tác thất bại' });
    } finally {
      setBusyId(null);
    }
  };

  const rows = policies.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Chính sách"
        description="Quản lý chính sách tuân thủ theo phiên bản, ngày hiệu lực và chu kỳ rà soát."
        action={
          canManage ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Tạo chính sách
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

      {canManage && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Không sửa trực tiếp bản ACTIVE — tạo phiên bản mới.</span>
        </div>
      )}

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Danh mục chính sách</h2>
          {policies.loading ? (
            <LoadingState />
          ) : policies.error ? (
            <ErrorState message={policies.error} onRetry={policies.reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="Chưa có chính sách" hint={canManage ? 'Nhấn “Tạo chính sách”' : undefined} />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3 font-semibold">Mã</th>
                    <th className="px-4 py-3 font-semibold">Tên</th>
                    <th className="px-4 py-3 font-semibold">Loại</th>
                    <th className="px-4 py-3 font-semibold">Phiên bản</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold">Rà soát pháp lý</th>
                    <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-ink-100/70 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-ink-700">{p.code}</td>
                      <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                      <td className="px-4 py-3 text-ink-600">{p.policyType}</td>
                      <td className="px-4 py-3 text-ink-600">{p.version}</td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-500">
                        {p.legalReviewState || '—'}
                        {p.reviewDueAt && <span className="block text-ink-400">Hạn: {formatDate(p.reviewDueAt)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            {(p.status === 'DRAFT' || p.status === 'UNDER_REVIEW') && (
                              <Button
                                size="sm"
                                loading={busyId === p.id}
                                onClick={() => doAction(p.id, () => api.patch(`/compliance/policies/${p.id}/status`, { status: 'ACTIVE' }), 'Đã kích hoạt chính sách.')}
                              >
                                Kích hoạt
                              </Button>
                            )}
                            {p.status === 'ACTIVE' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busyId === p.id}
                                  onClick={() => doAction(p.id, () => api.patch(`/compliance/policies/${p.id}/status`, { status: 'SUSPENDED' }), 'Đã tạm dừng chính sách.')}
                                >
                                  Tạm dừng
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busyId === p.id}
                                  onClick={() => doAction(p.id, () => api.post(`/compliance/policies/${p.id}/version`), 'Đã tạo phiên bản mới.')}
                                >
                                  Bản mới
                                </Button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {showCreate && canManage && (
        <CreatePolicyModal onClose={() => setShowCreate(false)} onCreated={() => policies.reload()} />
      )}
    </div>
  );
}

function CreatePolicyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    policyType: 'LEGAL',
    enforcementMode: 'ADVISORY',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post('/compliance/policies', form);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không thể tạo chính sách');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg">
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Tạo chính sách</h2>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">Mã</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="name">Tên</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="policyType">Loại</Label>
                <select
                  id="policyType"
                  className={SELECT_CLASS}
                  value={form.policyType}
                  onChange={(e) => setForm({ ...form, policyType: e.target.value })}
                >
                  {POLICY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="enforcementMode">Chế độ áp dụng</Label>
                <select
                  id="enforcementMode"
                  className={SELECT_CLASS}
                  value={form.enforcementMode}
                  onChange={(e) => setForm({ ...form, enforcementMode: e.target.value })}
                >
                  {ENFORCEMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Mô tả</Label>
              <textarea
                id="description"
                className="min-h-[120px] w-full rounded-xl border border-ink-200 bg-white/85 p-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
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
