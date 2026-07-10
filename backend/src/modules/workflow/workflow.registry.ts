import { PrismaService } from '../../common/prisma/prisma.service';
import { ScoringService } from '../ai/agents/scoring.service';

export interface WorkflowContext {
  prisma: PrismaService;
  scoring: ScoringService;
  tenantId: string;
}

export interface WorkflowDefinition {
  name: string;
  title: string;
  description: string;
  /** Deterministic action performed on manual run. Returns a JSON-serialisable summary. */
  run: (ctx: WorkflowContext) => Promise<Record<string, unknown>>;
}

/**
 * Workflow registry. All workflows here are MANUAL — they run only via an
 * explicit API call. There is intentionally no scheduler that auto-dispatches
 * these, satisfying the safety rule "scheduler must not run MANUAL workflows".
 */
export const WORKFLOWS: Record<string, WorkflowDefinition> = {
  product_rescore_all: {
    name: 'product_rescore_all',
    title: 'Chấm điểm lại toàn bộ sản phẩm',
    description: 'Tính lại điểm cơ hội (Product AI) cho tất cả sản phẩm đang hoạt động.',
    async run({ prisma, scoring, tenantId }) {
      const products = await prisma.product.findMany({
        where: { tenantId, status: 'active' },
        select: { id: true, costPrice: true, retailPrice: true, tags: true, primaryImageUrl: true, imageUrls: true },
      });
      let updated = 0;
      for (const p of products) {
        const s = scoring.score({
          costPrice: Number(p.costPrice),
          retailPrice: Number(p.retailPrice),
          tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
          hasImages: !!p.primaryImageUrl || (p.imageUrls?.length ?? 0) > 0,
        });
        await prisma.product.update({
          where: { id: p.id },
          data: {
            productScore: s.total_score,
            demandScore: s.demand_score,
            competitionScore: s.competition_score,
            profitMarginScore: s.profit_margin_score,
            contentViabilityScore: s.content_viability_score,
            riskScore: s.risk_score,
            scoreUpdatedAt: new Date(),
          },
        });
        updated++;
      }
      return { products_rescored: updated };
    },
  },

  low_stock_scan: {
    name: 'low_stock_scan',
    title: 'Quét tồn kho thấp',
    description: 'Tìm các biến thể có tồn kho dưới điểm đặt lại để cảnh báo nhập hàng.',
    async run({ prisma, tenantId }) {
      const variants = await prisma.productVariant.findMany({
        where: { product: { tenantId } },
        select: { id: true, variantSku: true, stockQuantity: true, reorderPoint: true },
      });
      const low = variants.filter((v) => v.stockQuantity <= v.reorderPoint);
      return {
        checked: variants.length,
        low_stock_count: low.length,
        items: low.slice(0, 50).map((v) => ({ variant_sku: v.variantSku, stock: v.stockQuantity, reorder_point: v.reorderPoint })),
      };
    },
  },

  daily_kpi_snapshot: {
    name: 'daily_kpi_snapshot',
    title: 'Chốt KPI trong ngày',
    description: 'Tính và lưu snapshot KPI hôm nay (doanh thu, đơn, khách) để dashboard tải nhanh.',
    async run({ prisma, tenantId }) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const active = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'completed'];

      const [rev, newOrders, completed, cancelled, newCustomers] = await Promise.all([
        prisma.order.aggregate({ _sum: { totalAmount: true }, where: { tenantId, status: { in: active }, createdAt: { gte: startOfDay } } }),
        prisma.order.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
        prisma.order.count({ where: { tenantId, status: 'completed', createdAt: { gte: startOfDay } } }),
        prisma.order.count({ where: { tenantId, status: 'cancelled', createdAt: { gte: startOfDay } } }),
        prisma.customer.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
      ]);
      const revenue = Number(rev._sum.totalAmount ?? 0);

      const snapshot = await prisma.dailyKpiSnapshot.upsert({
        where: { tenantId_snapshotDate: { tenantId, snapshotDate: startOfDay } },
        update: { totalRevenue: revenue, newOrders, completedOrders: completed, cancelledOrders: cancelled, newCustomers },
        create: { tenantId, snapshotDate: startOfDay, totalRevenue: revenue, newOrders, completedOrders: completed, cancelledOrders: cancelled, newCustomers },
      });
      return { snapshot_date: startOfDay.toISOString().slice(0, 10), revenue, new_orders: newOrders, snapshot_id: snapshot.id };
    },
  },
};
