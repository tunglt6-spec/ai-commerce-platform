'use client';

import { Badge, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { formatVND } from '@/lib/utils';

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

export default function CustomersPage() {
  const { data, loading, error, reload } = useApi<{ data: Customer[] }>('/customers?limit=50');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Khách hàng</h1>
        <p className="text-sm text-gray-500">Danh sách khách hàng và giá trị vòng đời</p>
      </div>

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
