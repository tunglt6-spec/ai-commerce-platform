import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  private async getOrder(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Validate readiness for fulfillment; returns issues + a suggested shipping method. */
  async check(tenantId: string, id: string) {
    const order = await this.getOrder(tenantId, id);
    // Hard blockers prevent fulfilment; warnings are informational only.
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!order.shippingAddress || order.shippingAddress.trim().length < 5) {
      issues.push('Địa chỉ giao hàng thiếu hoặc không hợp lệ');
    }
    if (order.items.length === 0) {
      issues.push('Đơn không có sản phẩm');
    }
    if (order.paymentStatus === 'unpaid') {
      warnings.push('Đơn chưa thanh toán (COD vẫn có thể xử lý)');
    }

    // Weight-based simple shipping suggestion.
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
    const suggested = totalQty > 5 ? 'GHN' : 'J&T';

    const result = {
      order_id: order.id,
      ready: issues.length === 0,
      issues,
      warnings,
      suggested_shipping: suggested,
      current_status: order.status,
    };

    await this.ai.logTask({
      tenantId,
      agentName: 'fulfillment_ai',
      taskType: 'fulfillment_check',
      inputData: { order_id: id },
      outputData: result,
      modelUsed: 'deterministic-rules',
      status: 'completed',
    });
    return result;
  }

  async markDelivered(tenantId: string, id: string) {
    const order = await this.getOrder(tenantId, id);
    if (order.status !== 'shipped') {
      throw new ConflictException(`Only shipped orders can be marked delivered (current: ${order.status})`);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'delivered', deliveredAt: new Date() },
      select: { id: true, status: true, deliveredAt: true },
    });
    await this.ai.logTask({
      tenantId,
      agentName: 'fulfillment_ai',
      taskType: 'mark_delivered',
      inputData: { order_id: id },
      status: 'completed',
    });
    return updated;
  }

  async markCompleted(tenantId: string, id: string) {
    const order = await this.getOrder(tenantId, id);
    if (order.status !== 'delivered') {
      throw new ConflictException(`Only delivered orders can be completed (current: ${order.status})`);
    }
    // Completing a COD-style order also marks it paid if it wasn't.
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'completed',
        paymentStatus: order.paymentStatus === 'unpaid' ? 'paid' : order.paymentStatus,
      },
      select: { id: true, status: true, paymentStatus: true },
    });
    await this.ai.logTask({
      tenantId,
      agentName: 'fulfillment_ai',
      taskType: 'mark_completed',
      inputData: { order_id: id },
      status: 'completed',
    });
    return updated;
  }

  /** Exception scan across active shipments (real data, tenant-scoped). */
  async exceptions(tenantId: string) {
    const now = new Date();
    const shipped = await this.prisma.order.findMany({
      where: { tenantId, status: 'shipped' },
      select: { id: true, orderNumber: true, shippedAt: true, estimatedDeliveryDate: true },
    });
    const overdue = shipped.filter(
      (o) => o.estimatedDeliveryDate && o.estimatedDeliveryDate < now,
    );
    return {
      shipped_count: shipped.length,
      overdue_count: overdue.length,
      overdue: overdue.map((o) => ({
        order_id: o.id,
        order_number: o.orderNumber,
        estimated_delivery_date: o.estimatedDeliveryDate,
      })),
    };
  }
}
