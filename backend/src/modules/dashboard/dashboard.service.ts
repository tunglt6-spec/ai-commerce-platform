import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'completed'];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private startOf(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - 6);
      return d;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private async revenueSince(tenantId: string, since: Date): Promise<number> {
    const agg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { tenantId, status: { in: ACTIVE_ORDER_STATUSES }, createdAt: { gte: since } },
    });
    return Number(agg._sum.totalAmount ?? 0);
  }

  async executiveSummary(tenantId: string) {
    const startDay = this.startOf('day');
    const startWeek = this.startOf('week');
    const startMonth = this.startOf('month');

    const [revToday, revWeek, revMonth] = await Promise.all([
      this.revenueSince(tenantId, startDay),
      this.revenueSince(tenantId, startWeek),
      this.revenueSince(tenantId, startMonth),
    ]);

    const [newOrders, pendingOrders, completedOrders] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: startDay } } }),
      this.prisma.order.count({ where: { tenantId, status: 'pending' } }),
      this.prisma.order.count({ where: { tenantId, status: 'completed' } }),
    ]);

    const [totalProducts, activeProducts, totalCustomers, newCustomers] = await Promise.all([
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, status: 'active' } }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId, createdAt: { gte: startDay } } }),
    ]);

    // Inventory value + low-stock count (tenant-scoped via product join).
    const inventory = await this.prisma.$queryRaw<{ stock_value: number; low_stock: number }[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(pv.stock_quantity * COALESCE(pv.retail_price, p.retail_price)), 0)::float AS stock_value,
        COUNT(*) FILTER (WHERE pv.stock_quantity <= pv.reorder_point)::int AS low_stock
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.tenant_id = ${tenantId}::uuid
    `);

    const topProducts = await this.prisma.$queryRaw<
      { id: string; name: string; units_sold: number; revenue: number }[]
    >(Prisma.sql`
      SELECT p.id, p.name,
             SUM(oi.quantity)::int AS units_sold,
             SUM(oi.subtotal)::float AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.status = ANY(${ACTIVE_ORDER_STATUSES})
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 5
    `);

    return {
      revenue: { today: revToday, this_week: revWeek, this_month: revMonth },
      orders: { new_today: newOrders, pending: pendingOrders, completed: completedOrders },
      products: { total: totalProducts, active: activeProducts },
      customers: { total: totalCustomers, new_today: newCustomers },
      inventory: {
        total_stock_value: inventory[0]?.stock_value ?? 0,
        low_stock_items: inventory[0]?.low_stock ?? 0,
      },
      top_products: topProducts,
    };
  }

  async productIntelligence(tenantId: string) {
    const topOpportunities = await this.prisma.product.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { productScore: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        productScore: true,
        demandScore: true,
        competitionScore: true,
        profitMarginScore: true,
        retailPrice: true,
      },
    });
    const worstPerformers = await this.prisma.product.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { productScore: 'asc' },
      take: 5,
      select: { id: true, name: true, productScore: true },
    });
    return {
      total_products: await this.prisma.product.count({ where: { tenantId } }),
      top_opportunities: topOpportunities,
      worst_performers: worstPerformers.map((p) => ({
        ...p,
        recommendation: Number(p.productScore) < 40 ? 'review_or_discontinue' : 'monitor',
      })),
    };
  }
}
