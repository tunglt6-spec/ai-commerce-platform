'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';

interface Proposal {
  id: string;
  agentId: string;
  actionType: string;
  platform?: string | null;
  riskLevel?: number | null;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = ['', 'ALLOWED', 'APPROVAL_REQUIRED', 'BLOCKED', 'EXECUTED'] as const;
const STATUS_LABELS: Record<string, string> = {
  '': 'Tất cả',
  ALLOWED: 'ALLOWED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  BLOCKED: 'BLOCKED',
  EXECUTED: 'EXECUTED',
};

function riskTone(level?: number | null): string {
  const v = level ?? 0;
  if (v >= 4) return 'cancelled';
  if (v === 3) return 'pending';
  return 'completed';
}

function statusTone(status: string): string {
  if (status === 'EXECUTED' || status === 'ALLOWED' || status === 'APPROVED') return 'completed';
  if (status === 'BLOCKED' || status === 'REJECTED' || status === 'FAILED') return 'cancelled';
  return 'pending';
}

export default function ComplianceProposalsPage() {
  const { canOperate } = usePermissions();
  const [status, setStatus] = useState<string>('');
  const path = `/compliance/proposals?limit=50${status ? `&status=${status}` : ''}`;
  const { data, loading, error, reload } = useApi<{ data: Proposal[] }>(path);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rows = data?.data ?? [];

  const execute = async (id: string) => {
    setBusyId(id);
    setMessage(null);
    setErrorMsg(null);
    try {
      await api.post(`/compliance/proposals/${id}/execute`);
      setMessage('Đã thực thi đề xuất qua Execution Gateway.');
      await reload();
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Không thể thực thi đề xuất.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Đề xuất hành động"
        description="Mọi hành động AI được đề xuất, chấm rủi ro và định tuyến qua Policy Guard."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f || 'all'}
            size="sm"
            variant={status === f ? 'primary' : 'secondary'}
            onClick={() => setStatus(f)}
          >
            {STATUS_LABELS[f]}
          </Button>
        ))}
      </div>

      {message && (
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">{message}</div>
      )}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{errorMsg}</div>
      )}

      <Card>
        <CardBody>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="Chưa có đề xuất" hint="Các hành động AI sẽ xuất hiện tại đây sau khi được Policy Guard chấm điểm." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Agent</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Nền tảng</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Rủi ro</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Thời gian</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const canExecute = (p.status === 'ALLOWED' || p.status === 'APPROVED') && canOperate;
                    return (
                      <tr key={p.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                        <td className="px-5 py-3.5 font-semibold text-ink-800">{p.agentId}</td>
                        <td className="px-5 py-3.5 text-ink-600">{p.actionType}</td>
                        <td className="px-5 py-3.5 text-ink-500">{p.platform || '—'}</td>
                        <td className="px-5 py-3.5">
                          <Badge tone={riskTone(p.riskLevel)}>{p.riskLevel ?? '—'}</Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-ink-500">{formatDate(p.createdAt)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {canExecute ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busyId === p.id}
                              disabled={busyId === p.id}
                              onClick={() => execute(p.id)}
                            >
                              Thực thi
                            </Button>
                          ) : (
                            <span className="text-xs text-ink-300">—</span>
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
    </div>
  );
}
