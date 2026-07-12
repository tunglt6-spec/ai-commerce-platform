'use client';

import { Badge, Button, Card, CardBody, ErrorState, Input, Label, LoadingState, PageHeader, StatCard } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { formatDate, formatNumber } from '@/lib/utils';
import { CheckCircle2, Download, Link2, PackageSearch, RefreshCw, ShoppingBag, Upload, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface ShopeeStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  shop_id: string | null;
  expires_at: string | null;
  last_error: string | null;
}

export default function ShopeePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ShopeeInner />
    </Suspense>
  );
}

function ShopeeInner() {
  const { canManage, canOperate } = usePermissions();
  const params = useSearchParams();
  const { data, loading, error, reload } = useApi<{ data: ShopeeStatus }>('/marketplace/shopee/status');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [orders, setOrders] = useState<any | null>(null);

  useEffect(() => {
    const r = params.get('shopee');
    if (r === 'connected') setMsg({ tone: 'ok', text: 'Đã cấp quyền cửa hàng Shopee thành công.' });
    else if (r === 'error') setMsg({ tone: 'err', text: 'Cấp quyền Shopee thất bại hoặc bị huỷ. Thử lại.' });
  }, [params]);

  const connect = async () => {
    setBusy('connect');
    setMsg(null);
    try {
      const res = await api.get<{ data: { url: string } }>('/marketplace/shopee/auth-url');
      window.location.href = res.data.url; // rời app sang trang cấp quyền Shopee
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Không lấy được URL cấp quyền' });
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setMsg(null);
    try {
      const res = await api.post('/marketplace/shopee/test');
      const name = res.data?.shop?.response?.shop_name ?? res.data?.shop?.shop_name ?? 'Shopee shop';
      setMsg({ tone: 'ok', text: `Kết nối OK — ${name}` });
      reload();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Test thất bại' });
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy('sync');
    setMsg(null);
    setOrders(null);
    try {
      const res = await api.get('/marketplace/shopee/orders?days=7');
      setOrders(res.data);
      setMsg({ tone: 'ok', text: `Đã lấy ${res.data.count} đơn trong ${res.data.window_days} ngày.` });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Đồng bộ đơn thất bại' });
    } finally {
      setBusy(null);
    }
  };

  const [pushForm, setPushForm] = useState({ product_id: '', shopee_item_id: '', price: '', stock: '' });

  const importProducts = async () => {
    setBusy('import');
    setMsg(null);
    try {
      const res = await api.post('/marketplace/shopee/products/import');
      setMsg({ tone: 'ok', text: `Nhập xong: ${res.data.imported} mới, ${res.data.updated} cập nhật (tổng ${res.data.count}).` });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Nhập sản phẩm thất bại' });
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    if (!pushForm.product_id) {
      setMsg({ tone: 'err', text: 'Nhập Product ID nội bộ cần đẩy.' });
      return;
    }
    setBusy('push');
    setMsg(null);
    try {
      const body: any = { shopee_item_id: pushForm.shopee_item_id || undefined };
      if (pushForm.price) body.price = Number(pushForm.price);
      if (pushForm.stock) body.stock = Number(pushForm.stock);
      const res = await api.post(`/marketplace/shopee/products/${pushForm.product_id}/push`, body);
      const d = res.data.decision?.decision;
      setMsg({
        tone: 'ok',
        text: `Đã tạo đề xuất đẩy (quyết định: ${d}). ${d === 'REQUIRE_APPROVAL' ? 'Vào "Phê duyệt" để duyệt, rồi "Đề xuất hành động" để Thực thi.' : ''}`,
      });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Tạo đề xuất đẩy thất bại' });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Ngắt kết nối Shopee? Token cấp quyền sẽ bị xoá.')) return;
    setBusy('disconnect');
    try {
      await api.post('/integrations/shopee/disconnect');
      setMsg({ tone: 'ok', text: 'Đã ngắt kết nối Shopee.' });
      reload();
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Ngắt kết nối thất bại' });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data!.data;

  return (
    <div className="space-y-6">
      <Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        ← Tích hợp
      </Link>
      <PageHeader
        eyebrow="Marketplace"
        title="Shopee"
        description="Kết nối cửa hàng Shopee qua Open Platform API v2 (OAuth + ký HMAC). Đọc đơn hàng an toàn (read-only)."
        action={<ShoppingBag className="h-6 w-6 text-brand-600" />}
      />

      {msg && (
        <div className={(msg.tone === 'ok' ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-700') + ' rounded-2xl px-4 py-3 text-sm'}>
          {msg.text}
        </div>
      )}

      {/* Trạng thái */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={s.connected ? CheckCircle2 : XCircle} label="Trạng thái" value={s.connected ? 'Đã kết nối' : s.configured ? 'Chưa cấp quyền' : 'Chưa cấu hình'} tone={s.connected ? 'brand' : 'amber'} />
        <StatCard icon={ShoppingBag} label="Shop ID" value={s.shop_id ?? '—'} />
        <StatCard icon={RefreshCw} label="Token hết hạn" value={s.expires_at ? formatDate(s.expires_at) : '—'} tone="blue" />
      </div>

      {s.last_error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Lỗi gần nhất: {s.last_error}</div>}

      {/* Chưa cấu hình env */}
      {!s.configured && (
        <Card>
          <CardBody>
            <h2 className="mb-2 text-lg font-semibold text-ink-950">Cần cấu hình trên máy chủ trước</h2>
            <p className="text-sm text-ink-600">
              Đăng ký ứng dụng tại <span className="font-medium">open.shopee.com</span> để lấy <code className="rounded bg-ink-100 px-1">partner_id</code> và{' '}
              <code className="rounded bg-ink-100 px-1">partner_key</code>, rồi đặt các biến sau vào <code className="rounded bg-ink-100 px-1">deploy/.env.prod</code> trên VPS và khởi động lại API:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink-950 p-4 text-xs text-ink-100">{`SHOPEE_PARTNER_ID=...
SHOPEE_PARTNER_KEY=...
SHOPEE_API_BASE=https://partner.shopeemobile.com
SHOPEE_REDIRECT_URL=https://store.picklefund.uk/api/v1/marketplace/shopee/callback`}</pre>
            <p className="mt-3 text-xs text-ink-500">Khoá được đặt qua môi trường, không nhập qua giao diện để bảo mật. Nhớ khai báo đúng Redirect URL trên Shopee console.</p>
          </CardBody>
        </Card>
      )}

      {/* Đã cấu hình nhưng chưa cấp quyền */}
      {s.configured && !s.connected && (
        <Card>
          <CardBody className="flex flex-col items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Cấp quyền cửa hàng</h2>
              <p className="text-sm text-ink-500">Bạn sẽ được chuyển sang Shopee để đăng nhập và cho phép ứng dụng truy cập cửa hàng, sau đó quay lại đây.</p>
            </div>
            <Button loading={busy === 'connect'} disabled={!canManage} onClick={connect}>
              <Link2 className="h-4 w-4" /> Cấp quyền cửa hàng Shopee
            </Button>
            {!canManage && <p className="text-xs text-ink-400">Cần quyền Manager để cấp quyền cửa hàng.</p>}
          </CardBody>
        </Card>
      )}

      {/* Đã kết nối */}
      {s.connected && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                Cửa hàng đã kết nối <Badge tone="completed">connected</Badge>
              </h2>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" loading={busy === 'test'} disabled={!canManage} onClick={test}>
                  <RefreshCw className="h-4 w-4" /> Test kết nối
                </Button>
                <Button size="sm" loading={busy === 'sync'} disabled={!canOperate} onClick={sync}>
                  <PackageSearch className="h-4 w-4" /> Đồng bộ đơn (7 ngày)
                </Button>
                <Button variant="secondary" size="sm" loading={busy === 'import'} disabled={!canOperate} onClick={importProducts}>
                  <Download className="h-4 w-4" /> Nhập sản phẩm
                </Button>
                <Button variant="danger" size="sm" loading={busy === 'disconnect'} disabled={!canManage} onClick={disconnect}>
                  Ngắt
                </Button>
              </div>
            </div>

            {orders && (
              <div>
                <p className="mb-2 text-sm text-ink-600">
                  {formatNumber(orders.count)} đơn trong {orders.window_days} ngày {orders.more ? '(còn nữa)' : ''}
                </p>
                {orders.orders?.length ? (
                  <div className="space-y-2">
                    {orders.orders.slice(0, 10).map((o: any) => (
                      <div key={o.order_sn} className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white/70 p-3 text-sm">
                        <span className="font-mono text-xs text-ink-700">{o.order_sn}</span>
                        <span className="flex items-center gap-2 text-ink-500">
                          <Badge>{o.order_status ?? '—'}</Badge>
                          {o.total_amount != null && <span className="number">{formatNumber(o.total_amount)} {o.currency ?? ''}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 px-4 py-6 text-center text-sm text-ink-500">Không có đơn trong khoảng thời gian này.</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Đẩy giá/tồn lên Shopee — qua Compliance Gateway */}
      {s.connected && (
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                <Upload className="h-4 w-4 text-brand-600" /> Đẩy giá / tồn lên Shopee
              </h2>
              <p className="text-sm text-ink-500">
                Đây là hành động ghi ra sàn — sẽ tạo <b>đề xuất</b> đi qua Compliance Gateway (thường cần phê duyệt) trước khi thực thi. Không đẩy trực tiếp.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pid">Product ID (nội bộ)</Label>
                <Input id="pid" value={pushForm.product_id} onChange={(e) => setPushForm({ ...pushForm, product_id: e.target.value })} placeholder="uuid sản phẩm" />
              </div>
              <div>
                <Label htmlFor="sid">Shopee item_id</Label>
                <Input id="sid" value={pushForm.shopee_item_id} onChange={(e) => setPushForm({ ...pushForm, shopee_item_id: e.target.value })} placeholder="item_id trên Shopee" />
              </div>
              <div>
                <Label htmlFor="pr">Giá mới (VND)</Label>
                <Input id="pr" type="number" min="0" value={pushForm.price} onChange={(e) => setPushForm({ ...pushForm, price: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="st">Tồn kho mới</Label>
                <Input id="st" type="number" min="0" value={pushForm.stock} onChange={(e) => setPushForm({ ...pushForm, stock: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-400">MVP: cập nhật giá/tồn cho item đã có trên Shopee. Tạo listing mới (add_item) ở bản sau.</p>
              <Button loading={busy === 'push'} disabled={!canOperate} onClick={push}>
                <Upload className="h-4 w-4" /> Tạo đề xuất đẩy
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
