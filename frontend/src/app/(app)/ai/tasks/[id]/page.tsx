'use client';

import { Badge, Button, Card, CardBody, ErrorState, LoadingState, StatCard } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { agentMeta } from '@/lib/agents';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { formatNumber } from '@/lib/utils';
import { ArrowLeft, Clock, Coins, Cpu, Timer } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Task {
  id: string;
  agentName: string;
  taskType: string;
  status: string;
  modelUsed?: string;
  tokensUsed?: number;
  estimatedCost?: string | number;
  executionTimeMs?: number;
  triggeredBy?: string;
  approvedBy?: string;
  errorMessage?: string;
  inputData?: unknown;
  outputData?: unknown;
  createdAt: string;
  completedAt?: string;
}

function statusTone(status: string): string {
  if (status === 'completed' || status === 'approved') return 'completed';
  if (status === 'failed' || status === 'rejected') return 'cancelled';
  return 'pending';
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  return new Date(v).toLocaleString('vi-VN');
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const empty = value === null || value === undefined || (typeof value === 'object' && Object.keys(value as object).length === 0);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      {empty ? (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 px-4 py-4 text-sm text-ink-500">Không có dữ liệu</p>
      ) : (
        <pre className="overflow-x-auto rounded-2xl bg-ink-950 p-4 text-xs leading-5 text-ink-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { canManage } = usePermissions();
  const { data, loading, error, reload } = useApi<{ data: Task }>(`/ai/tasks/${params.id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const decide = async (approved: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      await api.patch(`/ai/tasks/${params.id}/approve`, { approved });
      setMsg(approved ? 'Đã duyệt tác vụ.' : 'Đã từ chối tác vụ.');
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const t = data!.data;
  const meta = agentMeta(t.agentName);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/ai" className="inline-flex items-center gap-1.5 font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> AI Teammate
        </Link>
        <span className="text-ink-300">/</span>
        <Link href={`/ai/${t.agentName}`} className="font-medium text-ink-500 hover:text-ink-900">
          {meta.name}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">{t.taskType}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            {meta.name} · <Badge tone={statusTone(t.status)}>{t.status}</Badge>
          </p>
        </div>
        {t.status === 'awaiting_approval' && (
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy} disabled={!canManage} onClick={() => decide(false)}>
              Từ chối
            </Button>
            <Button loading={busy} disabled={!canManage} onClick={() => decide(true)}>
              Duyệt
            </Button>
          </div>
        )}
      </div>

      {msg && <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{msg}</div>}
      {t.status === 'awaiting_approval' && !canManage && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Cần quyền Manager để duyệt/từ chối tác vụ này.</div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Cpu} label="Model" value={t.modelUsed ?? '—'} />
        <StatCard icon={Coins} label="Chi phí" value={`$${Number(t.estimatedCost ?? 0).toFixed(4)}`} sub={`${formatNumber(t.tokensUsed ?? 0)} token`} tone="amber" />
        <StatCard icon={Timer} label="Thời gian chạy" value={t.executionTimeMs != null ? `${formatNumber(t.executionTimeMs)} ms` : '—'} tone="blue" />
        <StatCard icon={Clock} label="Kích hoạt bởi" value={t.triggeredBy ?? '—'} />
      </div>

      {t.errorMessage && (
        <Card>
          <CardBody>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Lỗi</p>
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{t.errorMessage}</div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <JsonBlock label="Dữ liệu vào" value={t.inputData} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <JsonBlock label="Kết quả" value={t.outputData} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">Thông tin thực thi</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row label="Tạo lúc" value={fmtDateTime(t.createdAt)} />
            <Row label="Hoàn tất lúc" value={fmtDateTime(t.completedAt)} />
            <Row label="Người duyệt" value={t.approvedBy ?? '—'} />
            <Row label="Mã tác vụ" value={t.id} mono />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100/70 py-2 last:border-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className={'text-right font-medium text-ink-900' + (mono ? ' font-mono text-xs' : '')}>{value}</dd>
    </div>
  );
}
