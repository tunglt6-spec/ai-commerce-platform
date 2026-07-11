'use client';

import { Badge, Button, Card, CardBody, ErrorState, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDate, formatVND } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, loading, error, reload } = useApi<{ data: any }>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const o = data!.data;

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg(okMsg);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = o.status === 'pending';
  const canShip = ['confirmed', 'packed'].includes(o.status);
  const canDeliver = o.status === 'shipped';
  const canComplete = o.status === 'delivered';
  const canReturn = ['shipped', 'delivered', 'completed'].includes(o.status);
  const canFollowUp = ['delivered', 'completed'].includes(o.status);

  const genFollowUp = async () => {
    setBusy(true);
    setFollowUp(null);
    setMsg(null);
    try {
      const res = await api.post(`/ai/raving-fan/follow-up/${id}`);
      setFollowUp(res.data.message);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Không tạo được tin nhắn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-950">{o.orderNumber}</h1>
          <p className="text-sm text-ink-500">
            <Badge tone={o.status}>{o.status}</Badge> · Thanh toán:{' '}
            <Badge tone={o.paymentStatus}>{o.paymentStatus}</Badge> · {formatDate(o.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button loading={busy} onClick={() => act(() => api.patch(`/orders/${id}/confirm`), 'Đã xác nhận đơn.')}>
              Xác nhận
            </Button>
          )}
          {canShip && (
            <Button
              loading={busy}
              onClick={() => act(() => api.post(`/orders/${id}/shipments`, { shipping_method: 'GHN' }), 'Đã tạo vận đơn.')}
            >
              Tạo vận đơn
            </Button>
          )}
          {canDeliver && (
            <Button loading={busy} onClick={() => act(() => api.patch(`/orders/${id}/deliver`), 'Đã giao hàng.')}>
              Đã giao
            </Button>
          )}
          {canComplete && (
            <Button loading={busy} onClick={() => act(() => api.patch(`/orders/${id}/complete`), 'Đã hoàn tất đơn.')}>
              Hoàn tất
            </Button>
          )}
          {canFollowUp && (
            <Button variant="secondary" loading={busy} onClick={genFollowUp}>
              Chăm sóc (Raving Fan)
            </Button>
          )}
          {canReturn && (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() =>
                act(() => api.post(`/orders/${id}/returns`, { reason: 'other', description: 'Khách yêu cầu hoàn' }), 'Đã tạo yêu cầu hoàn hàng.')
              }
            >
              Yêu cầu hoàn hàng
            </Button>
          )}
        </div>
      </div>

      {msg && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</div>}
      {followUp && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-3 text-sm text-ink-700">
          <p className="mb-1 text-xs font-semibold uppercase text-brand-600">Tin nhắn chăm sóc gợi ý</p>
          {followUp}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <h2 className="mb-4 text-base font-semibold text-ink-900">Sản phẩm</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-400">
                    <th className="py-2 font-medium">Sản phẩm</th>
                    <th className="py-2 text-right font-medium">SL</th>
                    <th className="py-2 text-right font-medium">Đơn giá</th>
                    <th className="py-2 text-right font-medium">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it: any) => (
                    <tr key={it.id} className="border-b border-ink-50 last:border-0">
                      <td className="py-2.5 text-ink-700">
                        {it.productName}
                        {it.variantName && <span className="text-ink-400"> · {it.variantName}</span>}
                      </td>
                      <td className="py-2.5 text-right">{it.quantity}</td>
                      <td className="py-2.5 text-right">{formatVND(it.unitPrice)}</td>
                      <td className="py-2.5 text-right font-medium text-ink-950">{formatVND(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2 text-sm">
            <h2 className="mb-2 text-base font-semibold text-ink-900">Thanh toán</h2>
            <Row label="Tạm tính" value={formatVND(o.subtotal)} />
            <Row label="Giảm giá" value={`- ${formatVND(o.discountAmount)}`} />
            <Row label="Vận chuyển" value={formatVND(o.shippingCost)} />
            <div className="border-t border-ink-100 pt-2">
              <Row label="Tổng cộng" value={formatVND(o.totalAmount)} bold />
            </div>
            {o.trackingNumber && <Row label="Mã vận đơn" value={o.trackingNumber} />}
            <div className="pt-2 text-xs text-ink-500">
              Giao tới: {o.shippingAddress}
            </div>
          </CardBody>
        </Card>
      </div>

      {o.returns?.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-ink-900">Hoàn hàng</h2>
            {o.returns.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between border-b border-ink-50 py-2 text-sm last:border-0">
                <span className="text-ink-600">{r.reason}</span>
                <Badge tone={r.status === 'refunded' ? 'completed' : r.status === 'rejected' ? 'cancelled' : 'pending'}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{label}</span>
      <span className={bold ? 'font-semibold text-ink-950' : 'text-ink-700'}>{value}</span>
    </div>
  );
}
