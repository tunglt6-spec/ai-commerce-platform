'use client';

import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingState } from '@/components/ui';
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
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <Heart className="h-4 w-4 text-brand-600" /> Raving Fan AI
          </h2>
          <Button size="sm" variant="secondary" loading={busy} disabled={!canManage} onClick={recompute}>
            Cập nhật phân khúc
          </Button>
        </div>
        {msg && <p className="mb-2 break-words text-xs text-brand-700">{msg}</p>}
        <p className="text-sm text-gray-600">
          Khách cần win-back (không mua &gt; 30 ngày):{' '}
          <span className="font-semibold text-gray-900">{winBack.data?.data.count ?? '…'}</span>
        </p>
        {(winBack.data?.data.customers.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {winBack.data!.data.customers.slice(0, 8).map((c) => (
              <span key={c.id} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Khách hàng</h1>
        <p className="text-sm text-gray-500">Danh sách khách hàng và giá trị vòng đời</p>
      </div>

      <RavingFanCard onSegmentsUpdated={reload} />

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.data.length === 0 ? (
          <EmptyState title="Chưa có khách hàng" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                  <th className="px-5 py-3 font-medium">Khách hàng</th>
                  <th className="px-5 py-3 font-medium">Liên hệ</th>
                  <th className="px-5 py-3 font-medium">Phân khúc</th>
                  <th className="px-5 py-3 text-right font-medium">Số đơn</th>
                  <th className="px-5 py-3 text-right font-medium">LTV</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {c.phone}
                      {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{c.segment ?? 'New'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{c.totalOrders}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatVND(c.lifetimeValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
