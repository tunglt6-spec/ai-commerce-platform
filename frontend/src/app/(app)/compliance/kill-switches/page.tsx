'use client';

import { Badge, Button, Card, CardBody, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

interface KillSwitch {
  id: string;
  scope: string;
  scopeValue: string | null;
  active: boolean;
  reason: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

const SCOPES: { scope: string; label: string }[] = [
  { scope: 'ALL_EXTERNAL', label: 'Toàn bộ hành động ra ngoài' },
  { scope: 'AUTO_PUBLISH', label: 'Tự động đăng bài' },
  { scope: 'AD_LAUNCH', label: 'Khởi chạy quảng cáo' },
  { scope: 'OUTBOUND_MARKETING', label: 'Gửi marketing' },
  { scope: 'FINANCIAL', label: 'Hành động tài chính' },
  { scope: 'DATA_COLLECTION', label: 'Thu thập dữ liệu' },
];

export default function KillSwitchesPage() {
  const { data, loading, error, reload } = useApi<{ data: KillSwitch[] }>('/compliance/kill-switches');
  const { canManage } = usePermissions();
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'ok' | 'error'>('ok');

  const items = data?.data ?? [];
  const findSwitch = (scope: string) =>
    items.find((it) => it.scope === scope && it.scopeValue == null);

  const toggle = async (scope: string, active: boolean) => {
    setBusyScope(scope);
    setMsg(null);
    try {
      await api.post('/compliance/kill-switches', {
        scope,
        active,
        ...(active ? { reason: 'Kích hoạt thủ công' } : {}),
      });
      setMsgTone('ok');
      setMsg(active ? 'Đã kích hoạt chặn phạm vi này.' : 'Đã gỡ chặn, cho phép trở lại.');
      reload();
    } catch (e) {
      setMsgTone('error');
      setMsg(e instanceof ApiError ? e.message : 'Không thể cập nhật kill switch');
    } finally {
      setBusyScope(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Governance"
        title="Kill switch"
        description="Dừng khẩn cấp các nhóm hành động AI. Execution Gateway kiểm tra realtime."
      />

      <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 ring-1 ring-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Khi bật, mọi hành động thuộc phạm vi sẽ bị Execution Gateway chặn ngay, kể cả đề xuất đã được
          duyệt.
        </p>
      </div>

      {msg && (
        <div
          className={
            msgTone === 'ok'
              ? 'rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 ring-1 ring-brand-200'
              : 'rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200'
          }
        >
          {msg}
        </div>
      )}

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {SCOPES.map(({ scope, label }) => {
                const sw = findSwitch(scope);
                const active = !!sw?.active;
                const busy = busyScope === scope;
                return (
                  <div
                    key={scope}
                    className={
                      'flex flex-col gap-4 rounded-2xl border p-5 transition ' +
                      (active
                        ? 'border-rose-200 bg-rose-50/60'
                        : 'border-ink-100 bg-white/60')
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ' +
                            (active ? 'bg-rose-100 text-rose-700' : 'bg-brand-50 text-brand-700')
                          }
                        >
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-950">{label}</p>
                          <p className="mt-0.5 text-xs text-ink-400">{scope}</p>
                        </div>
                      </div>
                      <Badge tone={active ? 'cancelled' : 'completed'}>
                        {active ? 'ĐANG CHẶN' : 'Đang cho phép'}
                      </Badge>
                    </div>

                    <div className="text-xs leading-5 text-ink-500">
                      <p>Cập nhật: {sw ? formatDate(sw.updatedAt) : '-'}</p>
                      {active && sw?.reason && <p className="mt-0.5">Lý do: {sw.reason}</p>}
                    </div>

                    {active ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        disabled={!canManage || busy}
                        onClick={() => toggle(scope, false)}
                      >
                        Bật lại
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        disabled={!canManage || busy}
                        onClick={() => toggle(scope, true)}
                      >
                        Kích hoạt chặn
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
