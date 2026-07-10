'use client';

import { Badge, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { formatDate, formatVND } from '@/lib/utils';
import { useState } from 'react';

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  customer?: { firstName?: string; lastName?: string; phone?: string };
}

const STATUSES = ['', 'pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled'];

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi<{ data: Order[] }>(
    `/orders?limit=50${status ? `&status=${status}` : ''}`,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Đơn hàng</h1>
        <p className="text-sm text-gray-500">Theo dõi và xử lý đơn hàng</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
              status === s ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s || 'Tất cả'}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.data.length === 0 ? (
          <EmptyState title="Chưa có đơn hàng" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                  <th className="px-5 py-3 font-medium">Mã đơn</th>
                  <th className="px-5 py-3 font-medium">Khách hàng</th>
                  <th className="px-5 py-3 text-right font-medium">Tổng tiền</th>
                  <th className="px-5 py-3 font-medium">Thanh toán</th>
                  <th className="px-5 py-3 font-medium">Trạng thái</th>
                  <th className="px-5 py-3 font-medium">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-800">{o.orderNumber}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || '—'}
                      <div className="text-xs text-gray-400">{o.customer?.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatVND(o.totalAmount)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={o.paymentStatus}>{o.paymentStatus}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={o.status}>{o.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(o.createdAt)}</td>
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
