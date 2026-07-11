'use client';

import { Badge, Card, CardBody, EmptyState, ErrorState, LoadingState, StatCard, TableWrap } from '@/components/ui';
import { agentMeta } from '@/lib/agents';
import { useApi } from '@/lib/use-api';
import { formatDate, formatNumber } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, Coins, ListChecks, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

interface Task {
  id: string;
  agentName: string;
  taskType: string;
  status: string;
  modelUsed?: string;
  tokensUsed?: number;
  estimatedCost?: string | number;
  createdAt: string;
}

function statusTone(status: string): string {
  if (status === 'completed' || status === 'approved') return 'completed';
  if (status === 'failed' || status === 'rejected') return 'cancelled';
  return 'pending';
}

export default function AgentDetailPage({ params }: { params: { agent: string } }) {
  const router = useRouter();
  const meta = agentMeta(params.agent);
  const Icon = meta.icon;
  const { data, loading, error, reload } = useApi<{ data: Task[] }>(
    `/ai/tasks?agent=${encodeURIComponent(params.agent)}&limit=50`,
  );

  const rows = data?.data ?? [];
  const stats = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let tokens = 0;
    let cost = 0;
    for (const t of rows) {
      if (t.status === 'completed' || t.status === 'approved') completed += 1;
      if (t.status === 'failed' || t.status === 'rejected') failed += 1;
      tokens += t.tokensUsed ?? 0;
      cost += Number(t.estimatedCost ?? 0);
    }
    return { total: rows.length, completed, failed, tokens, cost };
  }, [rows]);

  return (
    <div className="space-y-6">
      <Link href="/ai" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> AI Teammate
      </Link>

      <div className="relative overflow-hidden rounded-[1.75rem] border border-ink-900/10 bg-ink-900 px-5 py-6 text-white shadow-panel sm:px-7">
        <div className="absolute inset-0 bg-grid bg-[length:28px_28px] opacity-35" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-400/25 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-200">
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">{meta.name}</h1>
            <p className="mt-1 text-sm text-ink-100/82">{meta.desc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={ListChecks} label="Tổng tác vụ" value={formatNumber(stats.total)} />
        <StatCard icon={CheckCircle2} label="Hoàn tất" value={formatNumber(stats.completed)} />
        <StatCard icon={XCircle} label="Thất bại" value={formatNumber(stats.failed)} tone="rose" />
        <StatCard icon={Coins} label="Chi phí" value={`$${stats.cost.toFixed(4)}`} sub={`${formatNumber(stats.tokens)} token`} tone="amber" />
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Tác vụ gần đây</h2>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : rows.length === 0 ? (
            <EmptyState title="Agent này chưa có tác vụ" hint="Kích hoạt agent từ các trang tương ứng để ghi nhận tác vụ." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Tác vụ</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Model</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Token</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/ai/tasks/${t.id}`)}
                      className="cursor-pointer border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50"
                    >
                      <td className="px-5 py-3.5 font-semibold text-ink-800">{t.taskType}</td>
                      <td className="px-5 py-3.5 text-ink-500">{t.modelUsed ?? '—'}</td>
                      <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(t.tokensUsed ?? 0)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-500">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
