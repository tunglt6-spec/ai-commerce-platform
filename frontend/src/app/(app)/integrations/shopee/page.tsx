'use client';

import { Badge, Button, Card, CardBody, ErrorState, Input, Label, LoadingState, PageHeader, StatCard } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePermissions } from '@/lib/roles';
import { useApi } from '@/lib/use-api';
import { formatDate, formatNumber } from '@/lib/utils';
import { CheckCircle2, Download, Link2, PackagePlus, PackageSearch, RefreshCw, ShoppingBag, Truck, Upload, XCircle } from 'lucide-react';
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

  // ---- Tạo listing mới (add_item) ----
  const [refs, setRefs] = useState<{ logistics: any[]; categories: any[] } | null>(null);
  const [createForm, setCreateForm] = useState({
    product_id: '',
    category_id: '',
    price: '',
    stock: '',
    weight_kg: '0.5',
    length: '15',
    width: '15',
    height: '5',
    image_urls: '',
    condition: 'NEW',
  });
  const [logiSel, setLogiSel] = useState<Record<string, boolean>>({});

  const loadRefs = async () => {
    setBusy('refs');
    setMsg(null);
    try {
      const res = await api.get('/marketplace/shopee/listing-refs');
      const logistics = Array.isArray(res.data?.logistics) ? res.data.logistics : [];
      const categories = Array.isArray(res.data?.categories) ? res.data.categories : [];
      setRefs({ logistics, categories });
      setMsg({ tone: 'ok', text: `Đã tải ${logistics.length} kênh vận chuyển, ${categories.length} danh mục từ Shopee.` });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Không tải được danh mục/vận chuyển. Cần kết nối Shopee thật.' });
    } finally {
      setBusy(null);
    }
  };

  const createListing = async () => {
    if (!createForm.product_id || !createForm.category_id) {
      setMsg({ tone: 'err', text: 'Cần Product ID nội bộ và Category ID (lá) của Shopee.' });
      return;
    }
    const logistics = (refs?.logistics ?? [])
      .filter((l) => logiSel[String(l.logistics_channel_id)])
      .map((l) => ({ logistic_id: Number(l.logistics_channel_id), enabled: true }));
    if (!logistics.length) {
      setMsg({ tone: 'err', text: 'Chọn ít nhất 1 kênh vận chuyển (bấm "Tải danh mục & vận chuyển" trước).' });
      return;
    }
    setBusy('create');
    setMsg(null);
    try {
      const body: any = {
        category_id: Number(createForm.category_id),
        price: Number(createForm.price) || 0,
        stock: Number(createForm.stock) || 0,
        weight_kg: Number(createForm.weight_kg) || 0.1,
        logistics,
        dimension_cm: { length: Number(createForm.length) || 10, width: Number(createForm.width) || 10, height: Number(createForm.height) || 10 },
        condition: createForm.condition,
      };
      const urls = createForm.image_urls.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
      if (urls.length) body.image_urls = urls;
      const res = await api.post(`/marketplace/shopee/products/${createForm.product_id}/create-listing`, body);
      const d = res.data.decision?.decision;
      setMsg({
        tone: 'ok',
        text: `Đã tạo đề xuất tạo listing (quyết định: ${d}). ${d === 'REQUIRE_APPROVAL' ? 'Vào "Phê duyệt" để duyệt, rồi "Đề xuất hành động" để Thực thi (upload ảnh + add_item chạy khi thực thi).' : ''}`,
      });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof ApiError ? e.message : 'Tạo đề xuất listing thất bại' });
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
              <p className="text-xs text-ink-400">Cập nhật giá/tồn cho item đã có trên Shopee. Tạo listing mới (add_item) ở khối bên dưới.</p>
              <Button loading={busy === 'push'} disabled={!canOperate} onClick={push}>
                <Upload className="h-4 w-4" /> Tạo đề xuất đẩy
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tạo listing mới (add_item) — qua Compliance Gateway */}
      {s.connected && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                  <PackagePlus className="h-4 w-4 text-brand-600" /> Tạo listing mới (add_item)
                </h2>
                <p className="text-sm text-ink-500">
                  Đăng sản phẩm nội bộ lên Shopee kèm ảnh &amp; vận chuyển. Ghi ra sàn — tạo <b>đề xuất</b> qua Compliance Gateway; ảnh được upload và <code className="rounded bg-ink-100 px-1">add_item</code> chỉ chạy khi <b>Thực thi</b> sau phê duyệt.
                </p>
              </div>
              <Button variant="secondary" size="sm" loading={busy === 'refs'} disabled={!canOperate} onClick={loadRefs}>
                <Truck className="h-4 w-4" /> Tải danh mục &amp; vận chuyển
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cpid">Product ID (nội bộ)</Label>
                <Input id="cpid" value={createForm.product_id} onChange={(e) => setCreateForm({ ...createForm, product_id: e.target.value })} placeholder="uuid sản phẩm" />
              </div>
              <div>
                <Label htmlFor="ccat">Category ID (lá, Shopee)</Label>
                <Input id="ccat" type="number" value={createForm.category_id} onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })} placeholder={refs ? `${refs.categories.length} danh mục đã tải` : 'bấm Tải danh mục'} />
              </div>
              <div>
                <Label htmlFor="cprice">Giá (VND)</Label>
                <Input id="cprice" type="number" min="0" value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cstock">Tồn kho</Label>
                <Input id="cstock" type="number" min="0" value={createForm.stock} onChange={(e) => setCreateForm({ ...createForm, stock: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cw">Cân nặng (kg)</Label>
                <Input id="cw" type="number" min="0" step="0.01" value={createForm.weight_kg} onChange={(e) => setCreateForm({ ...createForm, weight_kg: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ccond">Tình trạng</Label>
                <select
                  id="ccond"
                  value={createForm.condition}
                  onChange={(e) => setCreateForm({ ...createForm, condition: e.target.value })}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-400 focus:outline-none"
                >
                  <option value="NEW">Mới</option>
                  <option value="USED">Đã dùng</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="cl">Dài (cm)</Label>
                <Input id="cl" type="number" min="1" value={createForm.length} onChange={(e) => setCreateForm({ ...createForm, length: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cwid">Rộng (cm)</Label>
                <Input id="cwid" type="number" min="1" value={createForm.width} onChange={(e) => setCreateForm({ ...createForm, width: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ch">Cao (cm)</Label>
                <Input id="ch" type="number" min="1" value={createForm.height} onChange={(e) => setCreateForm({ ...createForm, height: e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="cimg">Ảnh (mỗi URL 1 dòng — bỏ trống sẽ dùng ảnh sẵn của sản phẩm)</Label>
              <textarea
                id="cimg"
                rows={2}
                value={createForm.image_urls}
                onChange={(e) => setCreateForm({ ...createForm, image_urls: e.target.value })}
                placeholder="https://.../a.jpg&#10;https://.../b.jpg"
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-400 focus:outline-none"
              />
            </div>

            {refs && (
              <div>
                <Label>Kênh vận chuyển (chọn ít nhất 1)</Label>
                {refs.logistics.length ? (
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {refs.logistics.map((l: any) => {
                      const id = String(l.logistics_channel_id);
                      return (
                        <label key={id} className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white/70 px-3 py-2 text-sm text-ink-700">
                          <input
                            type="checkbox"
                            checked={!!logiSel[id]}
                            onChange={(e) => setLogiSel({ ...logiSel, [id]: e.target.checked })}
                            className="h-4 w-4 rounded border-ink-300 text-brand-600"
                          />
                          <span>{l.logistics_channel_name ?? `Kênh ${id}`}</span>
                          <span className="ml-auto font-mono text-xs text-ink-400">{id}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1 rounded-xl border border-dashed border-ink-200 bg-ink-50/70 px-3 py-3 text-sm text-ink-500">Chưa có kênh vận chuyển bật cho cửa hàng này.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-400">Danh mục &amp; thuộc tính bắt buộc khác nhau theo ngành hàng — nếu Shopee báo thiếu thuộc tính khi thực thi, bổ sung qua listing-refs.</p>
              <Button loading={busy === 'create'} disabled={!canOperate} onClick={createListing}>
                <PackagePlus className="h-4 w-4" /> Tạo đề xuất listing
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
