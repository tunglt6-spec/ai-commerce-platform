'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatVND } from '@/lib/utils';
import { Heart } from 'lucide-react';
import { useState } from 'react';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  segment?: string;
  totalOrders: number;
  lifetimeValue: string;
}

function RavingFanCard({ onSegmentsUpdated }: { onSegmentsUpdated: () => void }) {
  const winBack = useApi<{ data: { count: number; customers: any[] } }>('/ai/raving-fan/win-back?days=30');
  const { canManage } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const recompute = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/ai/raving-fan/recompute-segments');
      setMsg(`Đã cập nhật ${res.data.updated}/${res.data.total} khách. ${JSON.stringify(res.data.by_segment)}`);
      onSegmentsUpdated();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Lỗi cập nhật phân khúc');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
            <Heart className="h-4 w-4 text-brand-600" /> Raving Fan AI
          </h2>
          <Button size="sm" variant="secondary" loading={busy} disabled={!canManage} onClick={recompute}>
            Cập nhật phân khúc
          </Button>
        </div>
        {msg && <p className="mb-2 break-words text-xs text-brand-700">{msg}</p>}
        <p className="text-sm text-ink-600">
          Khách cần win-back, không mua hơn 30 ngày:{' '}
          <span className="font-semibold text-ink-950">{winBack.data?.data.count ?? '...'}</span>
        </p>
        {(winBack.data?.data.customers.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {winBack.data!.data.customers.slice(0, 8).map((c) => (
              <span key={c.id} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone}
              </span>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function CustomersPage() {
  const { data, loading, error, reload } = useApi<{ data: Customer[] }>('/customers?limit=50');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer OS"
        title="Khách hàng"
        description="Quản lý hồ sơ, phân khúc và giá trị vòng đời để Sales AI chăm sóc đúng người, đúng thời điểm."
      />

      <RavingFanCard onSegmentsUpdated={reload} />

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.data.length === 0 ? (
          <EmptyState title="Chưa có khách hàng" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-[0.12em] text-ink-400">
                  <th className="px-5 py-4 font-semibold">Khách hàng</th>
                  <th className="px-5 py-4 font-semibold">Liên hệ</th>
                  <th className="px-5 py-4 font-semibold">Phân khúc</th>
                  <th className="px-5 py-4 text-right font-semibold">Số đơn</th>
                  <th className="px-5 py-3 text-right font-medium">LTV</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((c) => (
                  <tr key={c.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-4 font-medium text-ink-900">
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-5 py-4 text-ink-600">
                      {c.phone}
                      {c.email && <div className="text-xs text-ink-400">{c.email}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <Badge>{c.segment ?? 'New'}</Badge>
                    </td>
                    <td className="number px-5 py-4 text-right text-ink-700">{c.totalOrders}</td>
                    <td className="number px-5 py-4 text-right font-medium text-ink-950">{formatVND(c.lifetimeValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
