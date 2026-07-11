'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface AuditEntry {
  id: string;
  actorType: string;
  actorId: string;
  agentId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  timestamp: string;
  correlationId: string;
}

function short(value?: string | null): string {
  if (!value) return '—';
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function actionTone(action: string): string {
  if (action.includes('DENIED') || action.includes('BLOCK')) return 'cancelled';
  if (action === 'EXECUTION' || action.includes('GRANTED')) return 'completed';
  return 'pending';
}

function buildPath(action: string, correlationId: string): string {
  return `/compliance/audit?limit=100${action ? `&action=${encodeURIComponent(action)}` : ''}${correlationId ? `&correlationId=${encodeURIComponent(correlationId)}` : ''}`;
}

export default function ComplianceAuditPage() {
  const [action, setAction] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [path, setPath] = useState(() => buildPath('', ''));

  const { data, loading, error, reload } = useApi<{ data: AuditEntry[]; pagination: unknown }>(path);

  const applyFilters = () => setPath(buildPath(action.trim(), correlationId.trim()));

  const entries = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Nhật ký kiểm toán bất biến"
        description="Bản ghi append-only cho mọi quyết định policy, phê duyệt và thực thi. Không thể xoá."
      />

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="filter-action">Hành động</Label>
              <Input
                id="filter-action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="EXECUTION, PROPOSAL_EVALUATED, APPROVAL_GRANTED…"
              />
            </div>
            <div>
              <Label htmlFor="filter-correlation">Correlation ID</Label>
              <Input
                id="filter-correlation"
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="corr-…"
              />
            </div>
            <Button onClick={applyFilters}>
              <Search className="h-4 w-4" /> Lọc
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Bản ghi kiểm toán</h2>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : entries.length === 0 ? (
            <EmptyState title="Chưa có bản ghi" hint="Điều chỉnh bộ lọc hoặc chờ hệ thống ghi nhận sự kiện mới." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Thời gian</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Chủ thể</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Agent</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Hành động</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Đối tượng</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Kết quả</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Correlation</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                      <td className="px-5 py-3.5 text-ink-500">{formatDate(e.timestamp)}</td>
                      <td className="px-5 py-3.5 text-ink-700">
                        <span className="font-semibold text-ink-800">{e.actorType}</span>{' '}
                        <span className="font-mono text-xs text-ink-500">{short(e.actorId)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-600">{e.agentId || '—'}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={actionTone(e.action)}>{e.action}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-600">
                        <span className="text-ink-700">{e.entityType}</span>{' '}
                        <span className="font-mono text-xs text-ink-500">{short(e.entityId)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-600">{e.result}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-500">{short(e.correlationId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <div className="rounded-2xl border border-ink-100 bg-ink-50/70 p-4 text-xs text-ink-600">
        Nhật ký này không có API xoá. Việc lưu trữ/hết hạn dùng quy trình archive riêng có quyền đặc biệt.
      </div>
    </div>
  );
}
