'use client';

import { Badge, Button, Card, CardBody, ErrorState, LoadingState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePermissions } from '@/lib/roles';
import { formatNumber, formatVND } from '@/lib/utils';
import { Boxes, DollarSign, Package, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

interface Summary {
  revenue: { today: number; this_week: number; this_month: number };
  orders: { new_today: number; pending: number; completed: number };
  products: { total: number; active: number };
  customers: { total: number; new_today: number };
  inventory: { total_stock_value: number; low_stock_items: number };
  top_products: { id: string; name: string; units_sold: number; revenue: number }[];
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{label}</p>
          <p className="truncate text-xl font-semibold text-gray-900">{value}</p>
          {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
        </div>
      </CardBody>
    </Card>
  );
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
      setTrend({ error: e instanceof ApiError ? e.message : 'Lỗi phân tích' });
    } finally {
      setTrendLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data!.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tổng quan</h1>
        <p className="text-sm text-gray-500">Chỉ số vận hành theo thời gian thực</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={DollarSign} label="Doanh thu hôm nay" value={formatVND(s.revenue.today)} sub={`Tuần: ${formatVND(s.revenue.this_week)}`} />
        <Kpi icon={ShoppingCart} label="Đơn mới hôm nay" value={formatNumber(s.orders.new_today)} sub={`Chờ xử lý: ${s.orders.pending}`} />
        <Kpi icon={Package} label="Sản phẩm" value={formatNumber(s.products.total)} sub={`Đang bán: ${s.products.active}`} />
        <Kpi icon={Users} label="Khách hàng" value={formatNumber(s.customers.total)} sub={`Mới hôm nay: ${s.customers.new_today}`} />
        <Kpi icon={DollarSign} label="Doanh thu tháng" value={formatVND(s.revenue.this_month)} />
        <Kpi icon={Boxes} label="Giá trị tồn kho" value={formatVND(s.inventory.total_stock_value)} sub={`Sắp hết: ${s.inventory.low_stock_items} mã`} />
        <Kpi icon={ShoppingCart} label="Đơn hoàn tất" value={formatNumber(s.orders.completed)} />
        <Kpi
          icon={TrendingUp}
          label="Chi phí AI (7 ngày)"
          value={`$${(cost?.data?.total_cost ?? 0).toFixed(4)}`}
          sub={`${formatNumber(cost?.data?.task_count ?? 0)} tác vụ`}
        />
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-gray-800">Top sản phẩm theo doanh thu</h2>
          {s.top_products.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Chưa có dữ liệu bán hàng</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                    <th className="pb-2 font-medium">Sản phẩm</th>
                    <th className="pb-2 text-right font-medium">Đã bán</th>
                    <th className="pb-2 text-right font-medium">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {s.top_products.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="py-3 text-right text-gray-600">{formatNumber(p.units_sold)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{formatVND(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-4 text-base font-semibold text-gray-800">Top cơ hội (Product AI)</h2>
            {(intel?.data?.top_opportunities?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Chưa có sản phẩm để chấm điểm</p>
            ) : (
              <div className="space-y-2">
                {intel!.data.top_opportunities.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-gray-700">{p.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-brand-600">{Number(p.productScore).toFixed(0)}</span>
                      <span className="text-xs text-gray-400">{formatVND(p.retailPrice)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
                <TrendingUp className="h-4 w-4 text-brand-600" /> Trend Hunter AI
              </h2>
              <Button size="sm" variant="secondary" loading={trendLoading} disabled={!canManage} onClick={runTrend}>
                Phân tích xu hướng
              </Button>
            </div>
            {!trend ? (
              <p className="text-sm text-gray-400">
                {canManage ? 'Nhấn để phân tích xu hướng từ dữ liệu bán 30 ngày.' : 'Cần quyền Manager để chạy phân tích.'}
              </p>
            ) : trend.error ? (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{trend.error}</div>
            ) : (
              <div className="space-y-2">
                {(trend.rising_products ?? []).slice(0, 5).map((p: any) => (
                  <div key={p.product_id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-gray-700">{p.name}</span>
                    <span className="text-xs text-gray-500">
                      bán {p.units_sold_30d} · điểm xu hướng <span className="font-semibold text-brand-600">{p.trend_score}</span>
                    </span>
                  </div>
                ))}
                {trend.narrative && (
                  <div className="mt-2 whitespace-pre-line rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-xs text-gray-700">
                    {trend.narrative}
                  </div>
                )}
                {(trend.rising_products ?? []).length === 0 && (
                  <p className="text-sm text-gray-400">Chưa đủ dữ liệu bán hàng để phân tích.</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
