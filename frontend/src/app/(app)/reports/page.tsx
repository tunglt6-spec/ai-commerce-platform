'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  StatCard,
  TableWrap,
} from '@/components/ui';
import { ApiError, downloadFile } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatNumber, formatVND } from '@/lib/utils';
import { Bot, Download, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';

type Tab = 'sales' | 'products' | 'customers' | 'ai-cost';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sales', label: 'Doanh thu' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'customers', label: 'Khách hàng' },
  { key: 'ai-cost', label: 'Chi phí AI' },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TH = 'px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400';
const ROW = 'border-b border-ink-100/70 last:border-0 hover:bg-brand-50/50';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');
  // Draft vs applied date range (avoid a request per keystroke).
  const [draft, setDraft] = useState({ from: daysAgoStr(29), to: todayStr() });
  const [range, setRange] = useState(draft);
  const [days, setDays] = useState(30);
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const path = useMemo(() => {
    if (tab === 'sales') return `/reports/sales?from=${range.from}&to=${range.to}`;
    if (tab === 'products') return `/reports/products?from=${range.from}&to=${range.to}`;
    if (tab === 'customers') return `/reports/customers`;
    return `/reports/ai-cost?days=${days}`;
  }, [tab, range, days]);

  const { data, loading, error, reload } = useApi<{ data: any }>(path);

  const exportCsv = async () => {
    setDownloading(true);
    setMsg(null);
    try {
      const qs = tab === 'ai-cost' ? `days=${days}` : `from=${range.from}&to=${range.to}`;
      await downloadFile(`/reports/export/${tab}?${qs}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Xuất CSV thất bại');
    } finally {
      setDownloading(false);
    }
  };

  const usesRange = tab === 'sales' || tab === 'products';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AICP Reports"
        title="Báo cáo & xuất dữ liệu"
        description="Doanh thu, hiệu suất sản phẩm, giá trị khách hàng và chi phí AI — tổng hợp từ dữ liệu vận hành thực, xuất CSV để phân tích sâu."
        action={
          <Button variant="secondary" loading={downloading} onClick={exportCsv}>
            <Download className="h-4 w-4" /> Xuất CSV
          </Button>
        }
      />

      {/* Segmented tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-ink-100 bg-white/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'rounded-xl px-4 py-2 text-sm font-semibold transition ' +
              (tab === t.key ? 'bg-ink-900 text-white shadow-card' : 'text-ink-500 hover:text-ink-900')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {usesRange ? (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">Từ ngày</Label>
              <Input id="from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="w-44" />
            </div>
            <div>
              <Label htmlFor="to">Đến ngày</Label>
              <Input id="to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="w-44" />
            </div>
            <Button onClick={() => setRange(draft)}>Xem báo cáo</Button>
          </CardBody>
        </Card>
      ) : tab === 'ai-cost' ? (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="days">Khoảng thời gian</Label>
              <select
                id="days"
                className="h-10 w-44 rounded-xl border border-ink-200 bg-white/85 px-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={7}>7 ngày qua</option>
                <option value={30}>30 ngày qua</option>
                <option value={90}>90 ngày qua</option>
              </select>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {msg && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{msg}</div>}

      {loading ? (
        <Card>
          <LoadingState />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          {tab === 'sales' && <SalesReport d={data!.data} />}
          {tab === 'products' && <ProductsReport d={data!.data} />}
          {tab === 'customers' && <CustomersReport d={data!.data} />}
          {tab === 'ai-cost' && <AiCostReport d={data!.data} />}
        </>
      )}
    </div>
  );
}

function SalesReport({ d }: { d: any }) {
  const series: any[] = d.series ?? [];
  const maxRev = Math.max(1, ...series.map((s) => s.revenue));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Doanh thu" value={formatVND(d.totals.revenue)} />
        <StatCard icon={ShoppingCart} label="Số đơn" value={formatNumber(d.totals.orders)} tone="blue" />
        <StatCard icon={TrendingUp} label="Số lượng bán" value={formatNumber(d.totals.units)} tone="amber" />
        <StatCard icon={Wallet} label="Giá trị đơn TB" value={formatVND(d.totals.avg_order_value)} />
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-5 text-lg font-semibold text-ink-950">Doanh thu theo ngày</h2>
          {series.length === 0 ? (
            <EmptyState title="Không có đơn trong khoảng này" hint="Chọn lại khoảng ngày hoặc chờ đơn hàng mới." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className={TH}>Ngày</th>
                    <th className={`${TH} text-right`}>Đơn</th>
                    <th className={`${TH} text-right`}>SL</th>
                    <th className={`${TH} text-right`}>Doanh thu</th>
                    <th className={`${TH} w-1/3`}>Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.date} className={ROW}>
                      <td className="px-5 py-3.5 font-medium text-ink-700">{s.date}</td>
                      <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(s.orders)}</td>
                      <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(s.units)}</td>
                      <td className="number px-5 py-3.5 text-right font-semibold text-ink-950">{formatVND(s.revenue)}</td>
                      <td className="px-5 py-3.5">
                        <div className="h-2 rounded-full bg-ink-100">
                          <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(s.revenue / maxRev) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ProductsReport({ d }: { d: any }) {
  const rows: any[] = d.rows ?? [];
  return (
    <Card>
      <CardBody>
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-950">Hiệu suất sản phẩm</h2>
          <Badge tone="active">{rows.length} sản phẩm</Badge>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Không có sản phẩm bán ra trong khoảng này" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className={TH}>SKU</th>
                  <th className={TH}>Sản phẩm</th>
                  <th className={`${TH} text-right`}>Đã bán</th>
                  <th className={`${TH} text-right`}>Số đơn</th>
                  <th className={`${TH} text-right`}>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product_id} className={ROW}>
                    <td className="px-5 py-3.5 text-ink-500">{r.sku}</td>
                    <td className="px-5 py-3.5 font-semibold text-ink-900">{r.name}</td>
                    <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(r.units)}</td>
                    <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(r.orders)}</td>
                    <td className="number px-5 py-3.5 text-right font-semibold text-ink-950">{formatVND(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </CardBody>
    </Card>
  );
}

function CustomersReport({ d }: { d: any }) {
  const rows: any[] = d.rows ?? [];
  const seg: any[] = d.by_segment ?? [];
  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-lg font-semibold text-ink-950">Giá trị khách hàng</h2>
        {seg.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {seg.map((s) => (
              <span key={s.segment} className="rounded-xl border border-ink-100 bg-brand-50/70 px-3 py-1.5 text-xs font-semibold capitalize text-brand-800">
                {s.segment}: {formatNumber(s.count)} KH · {formatVND(s.ltv)}
              </span>
            ))}
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState title="Chưa có khách hàng" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className={TH}>Khách hàng</th>
                  <th className={TH}>Liên hệ</th>
                  <th className={TH}>Phân khúc</th>
                  <th className={`${TH} text-right`}>Số đơn</th>
                  <th className={`${TH} text-right`}>LTV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customer_id} className={ROW}>
                    <td className="px-5 py-3.5 font-semibold text-ink-900">{r.name || '—'}</td>
                    <td className="px-5 py-3.5 text-ink-600">
                      {r.phone}
                      {r.email && <div className="text-xs text-ink-400">{r.email}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge>{r.segment}</Badge>
                    </td>
                    <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(r.total_orders)}</td>
                    <td className="number px-5 py-3.5 text-right font-semibold text-ink-950">{formatVND(r.lifetime_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </CardBody>
    </Card>
  );
}

function AiCostReport({ d }: { d: any }) {
  const rows: any[] = d.by_agent ?? [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Chi phí" value={`$${(d.total_cost ?? 0).toFixed(4)}`} />
        <StatCard icon={TrendingUp} label="Token" value={formatNumber(d.total_tokens)} tone="amber" />
        <StatCard icon={Bot} label="Tác vụ" value={formatNumber(d.task_count)} tone="blue" />
        <StatCard icon={Bot} label="Thất bại" value={formatNumber(d.failed_count)} tone="rose" />
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-5 text-lg font-semibold text-ink-950">Chi phí theo agent</h2>
          {rows.length === 0 ? (
            <EmptyState title="Chưa có tác vụ AI trong khoảng này" hint="Chạy các agent AI để bắt đầu ghi nhận chi phí." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className={TH}>Agent</th>
                    <th className={`${TH} text-right`}>Tác vụ</th>
                    <th className={`${TH} text-right`}>Thất bại</th>
                    <th className={`${TH} text-right`}>Token</th>
                    <th className={`${TH} text-right`}>Chi phí</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.agent} className={ROW}>
                      <td className="px-5 py-3.5 font-semibold text-ink-700">{r.agent}</td>
                      <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(r.task_count)}</td>
                      <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(r.failed_count)}</td>
                      <td className="number px-5 py-3.5 text-right text-ink-600">{formatNumber(r.token_usage)}</td>
                      <td className="number px-5 py-3.5 text-right font-semibold text-ink-950">${r.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
