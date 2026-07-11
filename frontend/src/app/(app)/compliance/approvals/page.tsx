'use client';

import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, TableWrap, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';

interface Approval {
  id: string;
  proposalId: string;
  approvalType: string;
  assignedRole: string;
  status: string;
  expiresAt: string;
  policyDecisionSnapshot?: { decision?: string; riskLevel?: string };
  createdAt: string;
}

export default function ApprovalsPage() {
  const { canManage } = usePermissions();
  const { data, loading, error, reload } = useApi<{ data: Approval[] }>('/compliance/approvals?limit=50');
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (id: string, approved: boolean) => {
    setBusy(id);
    setOk(null);
    setErr(null);
    try {
      await api.patch(`/compliance/approvals/${id}`, { approved });
      setOk(approved ? 'Đã duyệt đề xuất.' : 'Đã từ chối đề xuất.');
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Xử lý phê duyệt thất bại');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Phê duyệt"
        description="Hàng đợi phê duyệt các hành động AI rủi ro cao trước khi thực thi."
      />

      {ok && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{ok}</div>}
      {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (data!.data?.length ?? 0) === 0 ? (
          <EmptyState title="Không có phê duyệt nào đang chờ" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Đề xuất</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Loại</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Quyết định policy</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hết hạn</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((a) => (
                  <tr key={a.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-3.5 font-medium text-ink-900">
                      <span className="font-mono text-xs text-ink-700">{a.proposalId?.slice(0, 8) || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge>{a.approvalType}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {a.policyDecisionSnapshot?.decision && (
                          <span className="text-ink-700">{a.policyDecisionSnapshot.decision}</span>
                        )}
                        {a.policyDecisionSnapshot?.riskLevel && (
                          <Badge tone={a.policyDecisionSnapshot.riskLevel}>{a.policyDecisionSnapshot.riskLevel}</Badge>
                        )}
                        {!a.policyDecisionSnapshot?.decision && !a.policyDecisionSnapshot?.riskLevel && (
                          <span className="text-ink-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{formatDate(a.expiresAt)}</td>
                    <td className="px-5 py-3.5">
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            loading={busy === a.id}
                            disabled={busy === a.id}
                            onClick={() => decide(a.id, true)}
                          >
                            Duyệt
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy === a.id}
                            disabled={busy === a.id}
                            onClick={() => decide(a.id, false)}
                          >
                            Từ chối
                          </Button>
                        </div>
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

      {!canManage && <p className="text-xs text-ink-400">Chỉ Manager trở lên mới duyệt được.</p>}
    </div>
  );
}
