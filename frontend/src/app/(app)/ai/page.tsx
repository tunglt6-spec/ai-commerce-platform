'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { AGENTS, agentMeta } from '@/lib/agents';
import { useApi } from '@/lib/use-api';
import { formatDate, formatNumber } from '@/lib/utils';
import { Bot, ChevronRight, Coins, Cpu, LineChart, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function AnalyzeInsights() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/ai/analyze/insights');
      setResult(res.data);
    } catch (e) {
      setResult({ error: e instanceof ApiError ? e.message : 'Lỗi' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
            <LineChart className="h-5 w-5 text-brand-600" /> Analyze AI — nhận định
          </h2>
          <Button size="sm" variant="secondary" loading={loading} onClick={run}>
            Phân tích 30 ngày
          </Button>
        </div>
        {!result ? (
          <p className="text-sm text-ink-500">Nhấn “Phân tích 30 ngày” để tạo nhận định từ dữ liệu thật.</p>
        ) : result.error ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{result.error}</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Doanh thu" value={formatNumber(result.metrics.revenue) + 'đ'} />
              <Metric label="Đơn" value={formatNumber(result.metrics.orders)} />
              <Metric label="AOV" value={formatNumber(result.metrics.avg_order_value) + 'đ'} />
              <Metric label="Tỷ lệ hủy" value={result.metrics.cancellation_rate_percent + '%'} />
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm text-ink-700">
              {result.insights.map((i: string, idx: number) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
            {result.narrative && (
              <div className="whitespace-pre-line rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-sm text-ink-700">
                {result.narrative}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ink-50 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="number text-sm font-semibold text-ink-950">{value}</p>
    </div>
  );
}

interface Task {
  id: string;
  agentName: string;
  taskType: string;
  status: string;
  modelUsed?: string;
  tokensUsed?: number;
  createdAt: string;
}

function statusTone(status: string): string {
  if (status === 'completed' || status === 'approved') return 'completed';
  if (status === 'failed' || status === 'rejected') return 'cancelled';
  if (status === 'awaiting_approval') return 'pending';
  return 'pending';
}

export default function AiPage() {
  const router = useRouter();
  const { data: tasks, loading, error, reload } = useApi<{ data: Task[] }>('/ai/tasks?limit=30');
  const { data: cost } = useApi<{ data: any }>('/ai/cost/summary?days=30');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Operations"
        title="AI Teammate"
        description="Đội ngũ 8 agent AI vận hành cửa hàng — theo dõi chi phí, token và toàn bộ lịch sử tác vụ minh bạch."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Coins} label="Chi phí AI (30 ngày)" value={`$${(cost?.data?.total_cost ?? 0).toFixed(4)}`} />
        <StatCard icon={Cpu} label="Tổng token" value={formatNumber(cost?.data?.total_tokens ?? 0)} tone="amber" />
        <StatCard icon={ListChecks} label="Số tác vụ" value={formatNumber(cost?.data?.task_count ?? 0)} tone="blue" />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink-950">Đội ngũ AI</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {AGENTS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.key} href={`/ai/${a.key}`}>
                <Card className="group h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
                  <CardBody className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between text-sm font-semibold text-ink-900">
                        <span className="truncate">{a.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" />
                      </p>
                      <p className="text-xs text-ink-500">{a.desc}</p>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <AnalyzeInsights />

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Lịch sử tác vụ AI</h2>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : tasks!.data.length === 0 ? (
            <EmptyState title="Chưa có tác vụ AI" hint="Chạy chấm điểm hoặc tạo nội dung ở trang sản phẩm" />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Agent</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Tác vụ</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Model</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Token</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Trạng thái</th>
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks!.data.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/ai/tasks/${t.id}`)}
                      className="cursor-pointer border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50"
                    >
                      <td className="px-5 py-3.5 font-semibold text-ink-800">{agentMeta(t.agentName).name}</td>
                      <td className="px-5 py-3.5 text-ink-600">{t.taskType}</td>
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
