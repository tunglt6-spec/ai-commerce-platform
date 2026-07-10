import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiGatewayService } from '../ai/gateway/ai-gateway.service';
import { AiService } from '../ai/ai.service';
import { computeSegment } from './segment.util';

@Injectable()
export class RavingFanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly ai: AiService,
  ) {}

  /** Post-purchase follow-up message. Uses real customer/order data. */
  async followUp(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!['delivered', 'completed'].includes(order.status)) {
      throw new BadRequestException('Follow-up is available after delivery/completion');
    }
    const name = [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || 'quý khách';
    const start = Date.now();

    if (this.gateway.isConfigured) {
      const res = await this.gateway.complete({
        role: 'default',
        system: 'Bạn là nhân viên chăm sóc khách hàng thân thiện. Viết tiếng Việt, ngắn gọn.',
        prompt: `Viết tin nhắn cảm ơn ${name} đã mua đơn ${order.orderNumber}, mời đánh giá sản phẩm và gợi ý ưu đãi lần sau.`,
        maxTokens: 300,
      });
      await this.ai.logTask({
        tenantId,
        agentName: 'raving_fan_ai',
        taskType: 'follow_up',
        inputData: { order_id: orderId },
        modelUsed: res.model,
        tokensUsed: res.tokensUsed,
        estimatedCost: res.estimatedCost,
        status: res.ok ? 'completed' : 'failed',
        executionTimeMs: Date.now() - start,
      });
      if (res.ok && res.fromProvider) {
        return { from_provider: true, message: res.text.trim() };
      }
    }

    // Deterministic template using real data (clearly labeled, not AI-authored).
    await this.ai.logTask({
      tenantId,
      agentName: 'raving_fan_ai',
      taskType: 'follow_up',
      inputData: { order_id: orderId },
      modelUsed: 'template',
      status: 'completed',
      executionTimeMs: Date.now() - start,
    });
    return {
      from_provider: false,
      message:
        `Chào ${name}, cảm ơn bạn đã đặt đơn ${order.orderNumber}! ` +
        `Shop hy vọng bạn hài lòng với sản phẩm. Bạn dành 1 phút đánh giá giúp shop nhé — ` +
        `và nhận ưu đãi cho lần mua tiếp theo. Cảm ơn bạn! 💜`,
    };
  }

  /** Win-back candidates: customers inactive beyond `days`. */
  async winBack(tenantId: string, days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        totalOrders: { gt: 0 },
        lastPurchaseAt: { lt: cutoff },
      },
      orderBy: { lifetimeValue: 'desc' },
      take: 50,
      select: { id: true, firstName: true, lastName: true, phone: true, lifetimeValue: true, lastPurchaseAt: true, segment: true },
    });
    return { inactive_days: days, count: customers.length, customers };
  }

  /** Upsell/cross-sell: top-scored active products the customer hasn't bought. */
  async upsell(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Customer not found');

    const purchased = await this.prisma.orderItem.findMany({
      where: { order: { tenantId, customerId } },
      select: { variant: { select: { productId: true } } },
    });
    const purchasedProductIds = [...new Set(purchased.map((p) => p.variant.productId))];

    const suggestions = await this.prisma.product.findMany({
      where: { tenantId, status: 'active', id: { notIn: purchasedProductIds.length ? purchasedProductIds : undefined } },
      orderBy: { productScore: 'desc' },
      take: 5,
      select: { id: true, name: true, retailPrice: true, productScore: true },
    });
    return { customer_id: customerId, already_purchased: purchasedProductIds.length, suggestions };
  }

  /** Recompute segments for all customers (real data). Returns counts by segment. */
  async recomputeSegments(tenantId: string) {
    const now = new Date();
    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, totalOrders: true, lifetimeValue: true, lastPurchaseAt: true, segment: true },
    });
    const counts: Record<string, number> = {};
    let updated = 0;
    for (const c of customers) {
      const seg = computeSegment(
        { totalOrders: c.totalOrders, lifetimeValue: Number(c.lifetimeValue), lastPurchaseAt: c.lastPurchaseAt },
        now,
      );
      counts[seg] = (counts[seg] ?? 0) + 1;
      if (seg !== c.segment) {
        await this.prisma.customer.update({ where: { id: c.id }, data: { segment: seg } });
        updated++;
      }
    }
    return { total: customers.length, updated, by_segment: counts };
  }
}
