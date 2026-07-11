'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDate, formatNumber } from '@/lib/utils';
import { Bot, LineChart } from 'lucide-react';
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <LineChart className="h-4 w-4 text-brand-600" /> Analyze AI — nhận định
          </h2>
          <Button size="sm" variant="secondary" loading={loading} onClick={run}>
            Phân tích 30 ngày
          </Button>
        </div>
        {!result ? (
          <p className="text-sm text-ink-400">Nhấn “Phân tích” để tạo nhận định từ dữ liệu thật.</p>
        ) : result.error ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</div>
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
              <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-700 whitespace-pre-line">
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
    <div className="rounded-lg bg-ink-50 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-sm font-semibold text-ink-950">{value}</p>
    </div>
  );
}

const AGENTS = [
  { key: 'trend_hunter', name: 'Trend Hunter AI', desc: 'Phát hiện xu hướng & cơ hội' },
  { key: 'product_ai', name: 'Product AI', desc: 'Chấm điểm sản phẩm' },
  { key: 'content_ai', name: 'Content AI', desc: 'Mô tả, caption, SEO' },
  { key: 'video_ai', name: 'Video AI', desc: 'Kịch bản & shot list' },
  { key: 'sales_ai', name: 'Sales AI', desc: 'Tư vấn & chốt đơn' },
  { key: 'fulfillment_ai', name: 'Fulfillment AI', desc: 'Xử lý & giao hàng' },
  { key: 'raving_fan', name: 'Raving Fan AI', desc: 'Chăm sóc sau bán' },
  { key: 'analyze_ai', name: 'Analyze AI', desc: 'Phân tích & tối ưu' },
];

interface Task {
  id: string;
  agentName: string;
  taskType: string;
  status: string;
  modelUsed?: string;
  tokensUsed?: number;
  createdAt: string;
}

export default function AiPage() {
  const { data: tasks, loading, error, reload } = useApi<{ data: Task[] }>('/ai/tasks?limit=30');
  const { data: cost } = useApi<{ data: any }>('/ai/cost/summary?days=30');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-950">AI Teammate</h1>
        <p className="text-sm text-ink-500">Đội ngũ AI vận hành & lịch sử tác vụ</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {AGENTS.map((a) => (
          <Card key={a.key}>
            <CardBody className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{a.name}</p>
                <p className="text-xs text-ink-500">{a.desc}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <AnalyzeInsights />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-ink-500">Chi phí AI (30 ngày)</p>
            <p className="text-2xl font-semibold text-ink-950">${(cost?.data?.total_cost ?? 0).toFixed(4)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-ink-500">Tổng token</p>
            <p className="text-2xl font-semibold text-ink-950">{formatNumber(cost?.data?.total_tokens ?? 0)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-ink-500">Số tác vụ</p>
            <p className="text-2xl font-semibold text-ink-950">{formatNumber(cost?.data?.task_count ?? 0)}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-ink-900">Lịch sử tác vụ AI</h2>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : tasks!.data.length === 0 ? (
            <EmptyState title="Chưa có tác vụ AI" hint="Chạy chấm điểm hoặc tạo nội dung ở trang sản phẩm" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-400">
                    <th className="py-2 font-medium">Agent</th>
                    <th className="py-2 font-medium">Tác vụ</th>
                    <th className="py-2 font-medium">Model</th>
                    <th className="py-2 text-right font-medium">Token</th>
                    <th className="py-2 font-medium">Trạng thái</th>
                    <th className="py-2 font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks!.data.map((t) => (
                    <tr key={t.id} className="border-b border-ink-50 last:border-0">
                      <td className="py-2.5 font-medium text-ink-700">{t.agentName}</td>
                      <td className="py-2.5 text-ink-600">{t.taskType}</td>
                      <td className="py-2.5 text-ink-500">{t.modelUsed ?? '-'}</td>
                      <td className="py-2.5 text-right text-ink-600">{formatNumber(t.tokensUsed ?? 0)}</td>
                      <td className="py-2.5">
                        <Badge tone={t.status === 'completed' ? 'completed' : t.status === 'failed' ? 'cancelled' : 'pending'}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-ink-500">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
