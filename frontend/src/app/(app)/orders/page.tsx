'use client';

import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, TableWrap } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { formatDate, formatVND } from '@/lib/utils';
import Link from 'next/link';
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
const STATUS_LABELS: Record<string, string> = {
  '': 'Tất cả',
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi<{ data: Order[] }>(
    `/orders?limit=50${status ? `&status=${status}` : ''}`,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fulfillment"
        title="Đơn hàng"
        description="Theo dõi trạng thái xử lý, thanh toán và giao hàng để không bỏ sót đơn cần hành động."
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/70 bg-white/[0.72] p-2 shadow-card">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              status === s ? 'bg-brand-600 text-white shadow-card' : 'text-ink-600 hover:bg-ink-100'
            }`}
          >
            {STATUS_LABELS[s]}
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
          <TableWrap>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-[0.12em] text-ink-400">
                  <th className="px-5 py-4 font-semibold">Mã đơn</th>
                  <th className="px-5 py-4 font-semibold">Khách hàng</th>
                  <th className="px-5 py-4 text-right font-semibold">Tổng tiền</th>
                  <th className="px-5 py-4 font-semibold">Thanh toán</th>
                  <th className="px-5 py-4 font-semibold">Trạng thái</th>
                  <th className="px-5 py-4 font-semibold">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {data!.data.map((o) => (
                  <tr key={o.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                    <td className="px-5 py-4">
                      <Link href={`/orders/${o.id}`} className="font-medium text-brand-700 hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-ink-600">
                      {[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || '-'}
                      <div className="text-xs text-ink-400">{o.customer?.phone}</div>
                    </td>
                    <td className="number px-5 py-4 text-right font-medium text-ink-950">{formatVND(o.totalAmount)}</td>
                    <td className="px-5 py-4">
                      <Badge tone={o.paymentStatus}>{o.paymentStatus}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={o.status}>{o.status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-ink-500">{formatDate(o.createdAt)}</td>
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
