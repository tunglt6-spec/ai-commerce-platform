import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiGatewayService } from '../ai/gateway/ai-gateway.service';
import { AiService } from '../ai/ai.service';

const ACTIVE = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'completed'];

/**
 * Analyze AI: computes real KPI metrics, derives deterministic insights, and
 * (when a provider is configured) adds an AI narrative. Metrics are always real;
 * the narrative is clearly separated and never replaces the computed numbers.
 */
@Injectable()
export class AnalyzeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly ai: AiService,
  ) {}

  async insights(tenantId: string) {
    const start = Date.now();
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [revenueAgg, orderCount, cancelledCount, lowStock, topProduct] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
        where: { tenantId, status: { in: ACTIVE }, createdAt: { gte: since } },
      }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { tenantId, status: 'cancelled', createdAt: { gte: since } } }),
      this.prisma.productVariant.count({
        where: { product: { tenantId }, stockQuantity: { lte: 5 } },
      }),
      this.prisma.product.findFirst({
        where: { tenantId, status: 'active' },
        orderBy: { productScore: 'desc' },
        select: { name: true, productScore: true },
      }),
    ]);

    const revenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const aov = Number(revenueAgg._avg.totalAmount ?? 0);
    const cancelRate = orderCount > 0 ? Math.round((cancelledCount / orderCount) * 100) : 0;

    const metrics = {
      period_days: 30,
      revenue,
      orders: orderCount,
      avg_order_value: Math.round(aov),
      cancellation_rate_percent: cancelRate,
      low_stock_variants: lowStock,
      top_product: topProduct?.name ?? null,
    };

    // Deterministic, rule-based insights (always available, from real numbers).
    const insights: string[] = [];
    if (orderCount === 0) insights.push('Chưa có đơn hàng trong 30 ngày — ưu tiên tạo nội dung & chạy kênh bán.');
    if (cancelRate > 20) insights.push(`Tỷ lệ hủy đơn cao (${cancelRate}%) — rà soát quy trình xác nhận/thanh toán.`);
    if (lowStock > 0) insights.push(`${lowStock} biến thể tồn thấp — cân nhắc nhập thêm để tránh hết hàng.`);
    if (topProduct) insights.push(`Sản phẩm điểm cao nhất: "${topProduct.name}" — nên đẩy mạnh marketing.`);
    if (aov > 0) insights.push(`Giá trị đơn trung bình ~${Math.round(aov).toLocaleString('vi-VN')}đ — thử upsell/combo để tăng.`);
    if (insights.length === 0) insights.push('Các chỉ số ổn định; tiếp tục theo dõi.');

    // Optional AI narrative (grounded on the computed metrics).
    let narrative: string | null = null;
    let fromProvider = false;
    if (this.gateway.isConfigured) {
      const res = await this.gateway.complete({
        role: 'strategy',
        system: 'Bạn là chuyên gia phân tích thương mại điện tử. Chỉ dựa trên số liệu được cung cấp.',
        prompt: `Số liệu 30 ngày: ${JSON.stringify(metrics)}. Viết 3 nhận định & khuyến nghị ngắn gọn.`,
        maxTokens: 500,
      });
      if (res.ok && res.fromProvider) {
        narrative = res.text.trim();
        fromProvider = true;
      }
      await this.ai.logTask({
        tenantId,
        agentName: 'analyze_ai',
        taskType: 'insights',
        outputData: metrics,
        modelUsed: res.model,
        tokensUsed: res.tokensUsed,
        estimatedCost: res.estimatedCost,
        status: res.ok ? 'completed' : 'failed',
        executionTimeMs: Date.now() - start,
      });
    } else {
      await this.ai.logTask({
        tenantId,
        agentName: 'analyze_ai',
        taskType: 'insights',
        outputData: metrics,
        modelUsed: 'deterministic-rules',
        tokensUsed: 0,
        estimatedCost: 0,
        status: 'completed',
        executionTimeMs: Date.now() - start,
      });
    }

    return { metrics, insights, narrative, ai_narrative_from_provider: fromProvider };
  }
}
