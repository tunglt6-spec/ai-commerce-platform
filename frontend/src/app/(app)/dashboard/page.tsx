'use client';

import { Badge, Button, Card, CardBody, ErrorState, LoadingState, PageHeader, StatCard, TableWrap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatNumber, formatVND } from '@/lib/utils';
import { Boxes, DollarSign, Package, ShoppingCart, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

interface Summary {
  revenue: { today: number; this_week: number; this_month: number };
  orders: { new_today: number; pending: number; completed: number };
  products: { total: number; active: number };
  customers: { total: number; new_today: number };
  inventory: { total_stock_value: number; low_stock_items: number };
  top_products: { id: string; name: string; units_sold: number; revenue: number }[];
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useApi<{ data: Summary }>('/dashboards/executive/summary');
  const { data: cost } = useApi<{ data: { total_cost: number; total_tokens: number; task_count: number } }>(
    '/ai/cost/summary?days=7',
  );
  const { data: intel } = useApi<{ data: { top_opportunities: any[] } }>('/dashboards/products/intelligence');
  const { canManage } = usePermissions();
  const [trend, setTrend] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const runTrend = async () => {
    setTrendLoading(true);
    setTrend(null);
    try {
      const res = await api.post('/ai/trends/analyze');
      setTrend(res.data);
    } catch (e) {
      setTrend({ error: e instanceof ApiError ? e.message : 'Lỗi phân tích xu hướng' });
    } finally {
      setTrendLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data!.data;
  const opportunities = intel?.data?.top_opportunities ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AICP Command Center"
        title="Tổng quan vận hành"
        description="Theo dõi doanh thu, đơn hàng, tồn kho và tín hiệu AI theo thời gian thực để ra quyết định nhanh hơn."
        action={
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.08] p-2 text-center">
            <div className="px-3 py-2">
              <p className="number text-lg font-semibold">{formatNumber(s.orders.pending)}</p>
              <p className="text-[11px] text-ink-200">chờ xử lý</p>
            </div>
            <div className="px-3 py-2">
              <p className="number text-lg font-semibold">{formatNumber(s.inventory.low_stock_items)}</p>
              <p className="text-[11px] text-ink-200">sắp hết</p>
            </div>
            <div className="px-3 py-2">
              <p className="number text-lg font-semibold">${(cost?.data?.total_cost ?? 0).toFixed(4)}</p>
              <p className="text-[11px] text-ink-200">AI 7 ngày</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Doanh thu hôm nay" value={formatVND(s.revenue.today)} sub={`Tuần: ${formatVND(s.revenue.this_week)}`} />
        <StatCard icon={ShoppingCart} label="Đơn mới hôm nay" value={formatNumber(s.orders.new_today)} sub={`Chờ xử lý: ${s.orders.pending}`} tone="blue" />
        <StatCard icon={Package} label="Sản phẩm" value={formatNumber(s.products.total)} sub={`Đang bán: ${s.products.active}`} />
        <StatCard icon={Users} label="Khách hàng" value={formatNumber(s.customers.total)} sub={`Mới hôm nay: ${s.customers.new_today}`} tone="amber" />
        <StatCard icon={DollarSign} label="Doanh thu tháng" value={formatVND(s.revenue.this_month)} />
        <StatCard icon={Boxes} label="Giá trị tồn kho" value={formatVND(s.inventory.total_stock_value)} sub={`Sắp hết: ${s.inventory.low_stock_items} mã`} tone="rose" />
        <StatCard icon={ShoppingCart} label="Đơn hoàn tất" value={formatNumber(s.orders.completed)} tone="blue" />
        <StatCard
          icon={TrendingUp}
          label="Chi phí AI trong 7 ngày"
          value={`$${(cost?.data?.total_cost ?? 0).toFixed(4)}`}
          sub={`${formatNumber(cost?.data?.task_count ?? 0)} tác vụ`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-950">Top sản phẩm theo doanh thu</h2>
                <p className="text-sm text-ink-500">Dữ liệu bán hàng được xếp theo doanh thu thực ghi nhận.</p>
              </div>
              <Badge tone="active">{s.top_products.length} sản phẩm</Badge>
            </div>
            {s.top_products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-ink-700">Chưa có dữ liệu bán hàng</p>
                <p className="mt-1 text-xs text-ink-500">Khi đơn hoàn tất, bảng này sẽ tự động hiển thị sản phẩm có doanh thu tốt nhất.</p>
              </div>
            ) : (
              <TableWrap>
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-[0.12em] text-ink-400">
                      <th className="px-5 py-4 font-semibold">Sản phẩm</th>
                      <th className="px-5 py-4 text-right font-semibold">Đã bán</th>
                      <th className="px-5 py-4 text-right font-semibold">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.top_products.map((p, index) => (
                      <tr key={p.id} className="border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-100 text-xs font-bold text-ink-600">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-ink-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="number px-5 py-4 text-right text-ink-600">{formatNumber(p.units_sold)}</td>
                        <td className="number px-5 py-4 text-right font-semibold text-ink-950">{formatVND(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardBody className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-950">Trend Hunter AI</h2>
                <p className="text-sm text-ink-500">Đọc tín hiệu 30 ngày gần nhất.</p>
              </div>
              <Button size="sm" variant="secondary" loading={trendLoading} disabled={!canManage} onClick={runTrend}>
                Phân tích
              </Button>
            </div>
            {!trend ? (
              <div className="rounded-2xl bg-gradient-ai p-5 text-white">
                <Sparkles className="mb-4 h-5 w-5 text-white/90" aria-hidden />
                <p className="text-sm leading-6 text-white/90">
                  {canManage
                    ? 'Chạy phân tích để tìm sản phẩm đang tăng tốc, nhóm hàng cần đẩy nội dung và rủi ro tồn kho.'
                    : 'Cần quyền Manager để chạy phân tích xu hướng.'}
                </p>
              </div>
            ) : trend.error ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{trend.error}</div>
            ) : (
              <div className="space-y-3">
                {(trend.rising_products ?? []).slice(0, 5).map((p: any) => (
                  <div key={p.product_id} className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-ink-800">{p.name}</span>
                      <span className="number text-brand-700">{p.trend_score}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">Đã bán {p.units_sold_30d} trong 30 ngày</p>
                  </div>
                ))}
                {trend.narrative && (
                  <div className="whitespace-pre-line rounded-2xl bg-ink-50 p-4 text-xs leading-5 text-ink-700">{trend.narrative}</div>
                )}
                {(trend.rising_products ?? []).length === 0 && (
                  <p className="rounded-2xl bg-ink-50 p-4 text-sm text-ink-500">Chưa đủ dữ liệu bán hàng để phân tích.</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Top cơ hội Product AI</h2>
              <p className="text-sm text-ink-500">Sản phẩm có điểm cơ hội cao nhất để ưu tiên nội dung và tồn kho.</p>
            </div>
            <Badge tone="MEDIUM">Scoring</Badge>
          </div>
          {opportunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-ink-700">Chưa có sản phẩm để chấm điểm</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {opportunities.slice(0, 5).map((p) => (
                <div key={p.id} className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                  <p className="truncate text-sm font-semibold text-ink-800">{p.name}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="number text-3xl font-semibold text-brand-700">{Number(p.productScore).toFixed(0)}</span>
                    <span className="text-xs text-ink-500">{formatVND(p.retailPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
