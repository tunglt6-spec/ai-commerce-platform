'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { Play, Workflow as WorkflowIcon } from 'lucide-react';
import { useState } from 'react';

export default function WorkflowsPage() {
  const defs = useApi<{ data: any[] }>('/workflows');
  const execs = useApi<{ data: any[] }>('/workflow-executions?limit=20');
  const { canManage } = usePermissions();
  const [running, setRunning] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (name: string) => {
    setRunning(name);
    setMsg(null);
    try {
      const res = await api.post(`/workflows/${name}/run`);
      setMsg(`Đã chạy "${name}": ${JSON.stringify(res.data.outputData)}`);
      execs.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Chạy workflow thất bại');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-950">Tự động hoá</h1>
        <p className="text-sm text-ink-500">Workflow chạy thủ công · lịch sử thực thi</p>
      </div>

      {msg && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 break-words">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {defs.loading ? (
          <LoadingState />
        ) : defs.error ? (
          <ErrorState message={defs.error} onRetry={defs.reload} />
        ) : (
          defs.data!.data.map((w) => (
            <Card key={w.name}>
              <CardBody className="flex h-full flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <WorkflowIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{w.title}</p>
                    <Badge>{w.schedule_type}</Badge>
                  </div>
                </div>
                <p className="mb-4 flex-1 text-sm text-ink-500">{w.description}</p>
                <Button size="sm" loading={running === w.name} disabled={!canManage} onClick={() => run(w.name)}>
                  <Play className="h-4 w-4" /> Chạy ngay
                </Button>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-ink-900">Lịch sử thực thi</h2>
          {execs.loading ? (
            <LoadingState />
          ) : (execs.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có lần chạy nào" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-400">
                    <th className="py-2 font-medium">Workflow</th>
                    <th className="py-2 font-medium">Trạng thái</th>
                    <th className="py-2 text-right font-medium">Thời gian (ms)</th>
                    <th className="py-2 font-medium">Lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {execs.data!.data.map((e) => (
                    <tr key={e.id} className="border-b border-ink-50 last:border-0">
                      <td className="py-2.5 font-medium text-ink-700">{e.workflowName}</td>
                      <td className="py-2.5">
                        <Badge tone={e.status === 'completed' ? 'completed' : e.status === 'failed' ? 'cancelled' : 'pending'}>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right text-ink-600">{e.executionTimeMs ?? '-'}</td>
                      <td className="py-2.5 text-ink-500">{formatDate(e.createdAt)}</td>
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
