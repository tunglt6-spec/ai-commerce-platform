import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Order statuses that count as realised revenue (exclude cancelled/returned drafts). */
const REVENUE_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'completed'];

export interface DateRange {
  from: Date; // inclusive, start of day
  toExclusive: Date; // exclusive upper bound (start of the day after `to`)
  fromLabel: string; // YYYY-MM-DD
  toLabel: string; // YYYY-MM-DD
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve an inclusive [from, to] date range from optional YYYY-MM-DD strings.
   * Defaults to the last 30 days. `to` is expanded to end-of-day (exclusive next day).
   */
  resolveRange(from?: string, to?: string): DateRange {
    const parse = (s: string): Date => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (!m) throw new BadRequestException(`Ngày không hợp lệ: ${s} (định dạng YYYY-MM-DD)`);
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (Number.isNaN(d.getTime())) throw new BadRequestException(`Ngày không hợp lệ: ${s}`);
      return d;
    };

    const now = new Date();
    const toDay = to ? parse(to) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fromDay = from
      ? parse(from)
      : new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() - 29);

    if (fromDay > toDay) throw new BadRequestException('Khoảng ngày không hợp lệ: "từ" phải trước "đến".');

    const toExclusive = new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return { from: fromDay, toExclusive, fromLabel: fmt(fromDay), toLabel: fmt(toDay) };
  }

  /** Daily revenue / orders / units time series for realised orders in the range. */
  async salesReport(tenantId: string, range: DateRange) {
    const series = await this.prisma.$queryRaw<
      { date: string; orders: number; revenue: number }[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD') AS date,
             COUNT(*)::int AS orders,
             COALESCE(SUM(o.total_amount), 0)::float AS revenue
      FROM orders o
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.status = ANY(${REVENUE_STATUSES})
        AND o.created_at >= ${range.from}
        AND o.created_at < ${range.toExclusive}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const units = await this.prisma.$queryRaw<{ date: string; units: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD') AS date,
             COALESCE(SUM(oi.quantity), 0)::int AS units
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.status = ANY(${REVENUE_STATUSES})
        AND o.created_at >= ${range.from}
        AND o.created_at < ${range.toExclusive}
      GROUP BY 1
    `);
    const unitsByDate = new Map(units.map((u) => [u.date, u.units]));

    const rows = series.map((s) => ({
      date: s.date,
      orders: s.orders,
      revenue: s.revenue,
      units: unitsByDate.get(s.date) ?? 0,
    }));

    const totals = rows.reduce(
      (acc, r) => {
        acc.orders += r.orders;
        acc.revenue += r.revenue;
        acc.units += r.units;
        return acc;
      },
      { orders: 0, revenue: 0, units: 0 },
    );

    return {
      range: { from: range.fromLabel, to: range.toLabel },
      granularity: 'day',
      series: rows,
      totals: {
        ...totals,
        avg_order_value: totals.orders > 0 ? Math.round(totals.revenue / totals.orders) : 0,
      },
    };
  }

  /** Per-product performance (units sold, revenue, distinct orders) in the range. */
  async productsReport(tenantId: string, range: DateRange, limit = 100) {
    const rows = await this.prisma.$queryRaw<
      { product_id: string; name: string; sku: string; units: number; revenue: number; orders: number }[]
    >(Prisma.sql`
      SELECT p.id AS product_id, p.name, p.sku,
             SUM(oi.quantity)::int AS units,
             SUM(oi.subtotal)::float AS revenue,
             COUNT(DISTINCT o.id)::int AS orders
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.status = ANY(${REVENUE_STATUSES})
        AND o.created_at >= ${range.from}
        AND o.created_at < ${range.toExclusive}
      GROUP BY p.id, p.name, p.sku
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);
    return { range: { from: range.fromLabel, to: range.toLabel }, rows };
  }

  /** Customer value report + segment breakdown (all-time LTV, not range-bound). */
  async customersReport(tenantId: string, limit = 200) {
    const rows = await this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { lifetimeValue: 'desc' },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        segment: true,
        totalOrders: true,
        lifetimeValue: true,
      },
    });

    const bySegmentRaw = await this.prisma.$queryRaw<
      { segment: string; count: number; ltv: number }[]
    >(Prisma.sql`
      SELECT COALESCE(segment, 'new') AS segment,
             COUNT(*)::int AS count,
             COALESCE(SUM(lifetime_value), 0)::float AS ltv
      FROM customers
      WHERE tenant_id = ${tenantId}::uuid
      GROUP BY 1
      ORDER BY ltv DESC
    `);

    return {
      rows: rows.map((c) => ({
        customer_id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
        phone: c.phone,
        email: c.email,
        segment: c.segment ?? 'new',
        total_orders: c.totalOrders,
        lifetime_value: Number(c.lifetimeValue),
      })),
      by_segment: bySegmentRaw,
    };
  }

  /** AI cost/token usage report grouped by agent and by model over the last N days. */
  async aiCostReport(tenantId: string, days: number) {
    const safeDays = Math.min(Math.max(days || 30, 1), 365);
    const since = new Date(Date.now() - safeDays * 24 * 3600 * 1000);
    const tasks = await this.prisma.aiAgentTask.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { agentName: true, modelUsed: true, tokensUsed: true, estimatedCost: true, status: true },
    });

    const byAgent = new Map<string, { cost: number; tokens: number; count: number; failed: number }>();
    let totalCost = 0;
    let totalTokens = 0;
    let failed = 0;
    for (const t of tasks) {
      const cost = Number(t.estimatedCost ?? 0);
      const tokens = t.tokensUsed ?? 0;
      totalCost += cost;
      totalTokens += tokens;
      if (t.status === 'failed') failed += 1;
      const a = byAgent.get(t.agentName) ?? { cost: 0, tokens: 0, count: 0, failed: 0 };
      a.cost += cost;
      a.tokens += tokens;
      a.count += 1;
      if (t.status === 'failed') a.failed += 1;
      byAgent.set(t.agentName, a);
    }

    const round6 = (v: number) => Math.round(v * 1_000_000) / 1_000_000;
    return {
      period_days: safeDays,
      total_cost: round6(totalCost),
      total_tokens: totalTokens,
      task_count: tasks.length,
      failed_count: failed,
      by_agent: [...byAgent.entries()]
        .map(([agent, v]) => ({
          agent,
          cost: round6(v.cost),
          token_usage: v.tokens,
          task_count: v.count,
          failed_count: v.failed,
        }))
        .sort((a, b) => b.task_count - a.task_count),
    };
  }

  // ---- CSV export ----

  /** Serialize rows to RFC-4180 CSV with a BOM so Excel opens UTF-8 (Vietnamese) correctly. */
  toCsv(headers: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
    const esc = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = headers.map((h) => esc(h.label)).join(',');
    const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(',')).join('\r\n');
    return `﻿${head}\r\n${body}`;
  }

  async exportCsv(
    tenantId: string,
    type: string,
    range: DateRange,
    days: number,
  ): Promise<{ filename: string; csv: string }> {
    switch (type) {
      case 'sales': {
        const r = await this.salesReport(tenantId, range);
        return {
          filename: `sales_${range.fromLabel}_${range.toLabel}.csv`,
          csv: this.toCsv(
            [
              { key: 'date', label: 'Ngày' },
              { key: 'orders', label: 'Số đơn' },
              { key: 'units', label: 'Số lượng' },
              { key: 'revenue', label: 'Doanh thu (VND)' },
            ],
            r.series,
          ),
        };
      }
      case 'products': {
        const r = await this.productsReport(tenantId, range, 1000);
        return {
          filename: `products_${range.fromLabel}_${range.toLabel}.csv`,
          csv: this.toCsv(
            [
              { key: 'sku', label: 'SKU' },
              { key: 'name', label: 'Sản phẩm' },
              { key: 'units', label: 'Đã bán' },
              { key: 'orders', label: 'Số đơn' },
              { key: 'revenue', label: 'Doanh thu (VND)' },
            ],
            r.rows,
          ),
        };
      }
      case 'customers': {
        const r = await this.customersReport(tenantId, 5000);
        return {
          filename: `customers_${range.toLabel}.csv`,
          csv: this.toCsv(
            [
              { key: 'name', label: 'Khách hàng' },
              { key: 'phone', label: 'SĐT' },
              { key: 'email', label: 'Email' },
              { key: 'segment', label: 'Phân khúc' },
              { key: 'total_orders', label: 'Số đơn' },
              { key: 'lifetime_value', label: 'LTV (VND)' },
            ],
            r.rows,
          ),
        };
      }
      case 'ai-cost': {
        const r = await this.aiCostReport(tenantId, days);
        return {
          filename: `ai_cost_${r.period_days}d.csv`,
          csv: this.toCsv(
            [
              { key: 'agent', label: 'Agent' },
              { key: 'task_count', label: 'Số tác vụ' },
              { key: 'failed_count', label: 'Thất bại' },
              { key: 'token_usage', label: 'Token' },
              { key: 'cost', label: 'Chi phí (USD)' },
            ],
            r.by_agent,
          ),
        };
      }
      default:
        throw new BadRequestException(`Loại báo cáo không hợp lệ: ${type}`);
    }
  }
}
