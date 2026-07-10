import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AiGatewayService } from '../gateway/ai-gateway.service';

export interface TrendItem {
  product_id: string;
  name: string;
  product_score: number;
  units_sold_30d: number;
  revenue_30d: number;
  trend_score: number; // combined opportunity signal 0..100
}

export interface TrendResult {
  window_days: number;
  rising_products: TrendItem[];
  rising_categories: { category: string; units_sold_30d: number; revenue_30d: number }[];
  narrative: string | null;
  from_provider: boolean;
}

/**
 * Trend Hunter AI — discovers opportunities from REAL internal signals: product
 * opportunity score + recent sales velocity (last 30 days). It never fabricates
 * external market data (live marketplace/Google Trends crawling is Phase 2); it
 * ranks what the tenant's own data shows is rising, and adds an AI narrative when
 * a provider is configured.
 */
@Injectable()
export class TrendHunterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  async analyze(tenantId: string): Promise<TrendResult> {
    const days = 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const sinceStr = since.toISOString();

    // Units sold + revenue per product in the window (real order data, tenant-scoped).
    const productVelocity = await this.prisma.$queryRaw<
      { id: string; name: string; product_score: number; units: number; revenue: number }[]
    >(Prisma.sql`
      SELECT p.id, p.name, p.product_score::float AS product_score,
             COALESCE(SUM(oi.quantity),0)::int AS units,
             COALESCE(SUM(oi.subtotal),0)::float AS revenue
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      LEFT JOIN order_items oi ON oi.variant_id = pv.id
      LEFT JOIN orders o ON o.id = oi.order_id
        AND o.tenant_id = ${tenantId}::uuid
        AND o.status <> 'cancelled'
        AND o.created_at >= ${sinceStr}::timestamp
      WHERE p.tenant_id = ${tenantId}::uuid AND p.status = 'active'
      GROUP BY p.id, p.name, p.product_score
      ORDER BY units DESC, product_score DESC
      LIMIT 10
    `);

    const rising_products: TrendItem[] = productVelocity.map((r) => {
      // Trend score = 60% opportunity score + 40% normalized velocity (cap at 20 units).
      const velocityNorm = Math.min(1, r.units / 20) * 100;
      const trend = Math.round(Number(r.product_score) * 0.6 + velocityNorm * 0.4);
      return {
        product_id: r.id,
        name: r.name,
        product_score: Number(r.product_score),
        units_sold_30d: r.units,
        revenue_30d: r.revenue,
        trend_score: trend,
      };
    });

    const rising_categories = await this.prisma.$queryRaw<
      { category: string; units: number; revenue: number }[]
    >(Prisma.sql`
      SELECT c.name AS category,
             COALESCE(SUM(oi.quantity),0)::int AS units,
             COALESCE(SUM(oi.subtotal),0)::float AS revenue
      FROM categories c
      JOIN products p ON p.category_id = c.id
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      LEFT JOIN order_items oi ON oi.variant_id = pv.id
      LEFT JOIN orders o ON o.id = oi.order_id
        AND o.tenant_id = ${tenantId}::uuid
        AND o.status <> 'cancelled'
        AND o.created_at >= ${sinceStr}::timestamp
      WHERE c.tenant_id = ${tenantId}::uuid
      GROUP BY c.name
      ORDER BY units DESC
      LIMIT 5
    `);

    let narrative: string | null = null;
    let fromProvider = false;
    if (this.gateway.isConfigured && rising_products.length > 0) {
      const res = await this.gateway.complete({
        role: 'strategy',
        system: 'Bạn là chuyên gia phân tích xu hướng thương mại điện tử. Chỉ dựa trên dữ liệu được cung cấp.',
        prompt: `Dữ liệu ${days} ngày — sản phẩm nổi bật: ${JSON.stringify(
          rising_products.map((p) => ({ name: p.name, units: p.units_sold_30d, score: p.product_score })),
        )}. Viết 3 nhận định xu hướng & khuyến nghị đẩy hàng ngắn gọn.`,
        maxTokens: 500,
      });
      if (res.ok && res.fromProvider) {
        narrative = res.text.trim();
        fromProvider = true;
      }
    }

    return {
      window_days: days,
      rising_products,
      rising_categories: rising_categories.map((c) => ({
        category: c.category,
        units_sold_30d: c.units,
        revenue_30d: c.revenue,
      })),
      narrative,
      from_provider: fromProvider,
    };
  }
}
