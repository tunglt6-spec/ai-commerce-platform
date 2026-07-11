'use client';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  StatCard,
  TableWrap,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate, formatNumber } from '@/lib/utils';
import { AlertTriangle, Flame, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

interface Incident {
  id: string;
  incidentType: string;
  severity: string;
  status: string;
  affectedPlatform?: string | null;
  detectedAt: string;
  description?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  proposalId?: string | null;
  agentId?: string | null;
}

const STATUS_OPTIONS = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'];

function severityTone(severity: string): string {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'cancelled';
  if (severity === 'MEDIUM') return 'pending';
  return 'completed';
}

function statusTone(status: string): string {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'completed';
  return 'pending';
}

export default function IncidentsPage() {
  const { canManage } = usePermissions();
  const { data, loading, error, reload } = useApi<{ data: Incident[] }>('/compliance/incidents?limit=100');

  const [active, setActive] = useState<Incident | null>(null);
  const [form, setForm] = useState({ status: 'OPEN', rootCause: '', correctiveAction: '' });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const incidents = data?.data ?? [];
  const total = incidents.length;
  const openCount = incidents.filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length;
  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL').length;

  const openModal = (i: Incident) => {
    setErr(null);
    setOk(null);
    setActive(i);
    setForm({
      status: i.status || 'OPEN',
      rootCause: i.rootCause || '',
      correctiveAction: i.correctiveAction || '',
    });
  };

  const closeModal = () => {
    setActive(null);
    setBusy(false);
    setErr(null);
  };

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await api.patch(`/compliance/incidents/${active.id}`, form);
      setOk('Đã cập nhật sự cố.');
      closeModal();
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Cập nhật sự cố thất bại');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Sự cố tuân thủ"
        description="Theo dõi và xử lý các sự cố phát sinh từ hành động AI."
      />

      {ok && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{ok}</div>}
      {err && !active && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldAlert} label="Tổng sự cố" value={formatNumber(total)} sub="Trong danh sách" />
        <StatCard icon={AlertTriangle} label="Đang mở" value={formatNumber(openCount)} sub="OPEN / INVESTIGATING" tone="rose" />
        <StatCard icon={Flame} label="Nghiêm trọng" value={formatNumber(criticalCount)} sub="Mức CRITICAL" tone="rose" />
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : incidents.length === 0 ? (
          <EmptyState title="Chưa có sự cố nào" hint="Đây là một dấu hiệu tốt." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Loại</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Mức độ</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Nền tảng</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Phát hiện</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-3.5 font-medium text-ink-900">{i.incidentType}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{i.affectedPlatform || '—'}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{formatDate(i.detectedAt)}</td>
                    <td className="px-5 py-3.5">
                      {canManage ? (
                        <Button size="sm" variant="secondary" onClick={() => openModal(i)}>
                          Xử lý
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

      {!canManage && <p className="text-xs text-ink-400">Chỉ Manager trở lên mới xử lý được sự cố.</p>}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={closeModal} />
          <Card className="relative z-10 w-full max-w-lg">
            <div className="space-y-5 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">Xử lý sự cố</p>
                <h2 className="mt-1 text-lg font-semibold text-ink-900">{active.incidentType}</h2>
                {active.description && <p className="mt-1 text-sm leading-6 text-ink-500">{active.description}</p>}
              </div>

              {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

              <div>
                <Label htmlFor="incident-status">Trạng thái</Label>
                <select
                  id="incident-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-ink-200 bg-white/[0.85] px-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="incident-root">Nguyên nhân gốc</Label>
                <textarea
                  id="incident-root"
                  value={form.rootCause}
                  onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-ink-200 bg-white/[0.85] px-3 py-2 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  placeholder="Mô tả nguyên nhân gốc của sự cố…"
                />
              </div>

              <div>
                <Label htmlFor="incident-action">Hành động khắc phục</Label>
                <textarea
                  id="incident-action"
                  value={form.correctiveAction}
                  onChange={(e) => setForm((f) => ({ ...f, correctiveAction: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-ink-200 bg-white/[0.85] px-3 py-2 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  placeholder="Mô tả hành động khắc phục…"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={closeModal} disabled={busy}>
                  Hủy
                </Button>
                <Button size="sm" onClick={submit} loading={busy} disabled={busy}>
                  Lưu cập nhật
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
