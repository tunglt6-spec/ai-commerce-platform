import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface Notification {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  count: number;
}

/**
 * Notifications are DERIVED from real operational state (no fabricated data,
 * no extra table): low stock, pending orders, AI tasks awaiting approval,
 * and return requests. Always reflects the current tenant's actual data.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<{ notifications: Notification[]; total: number }> {
    const lowStock = await this.prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.tenant_id = ${tenantId}::uuid AND pv.stock_quantity <= pv.reorder_point
    `);
    const [pendingOrders, awaitingApproval, returnRequests] = await Promise.all([
      this.prisma.order.count({ where: { tenantId, status: 'pending' } }),
      this.prisma.aiAgentTask.count({ where: { tenantId, status: 'awaiting_approval' } }),
      this.prisma.return.count({ where: { status: 'requested', order: { tenantId } } }),
    ]);

    const notifications: Notification[] = [];
    const low = lowStock[0]?.n ?? 0;
    if (low > 0)
      notifications.push({
        type: 'low_stock',
        severity: 'warning',
        message: `${low} biến thể sắp hết hàng (dưới điểm đặt lại)`,
        count: low,
      });
    if (pendingOrders > 0)
      notifications.push({
        type: 'pending_orders',
        severity: 'info',
        message: `${pendingOrders} đơn hàng chờ xác nhận`,
        count: pendingOrders,
      });
    if (awaitingApproval > 0)
      notifications.push({
        type: 'ai_awaiting_approval',
        severity: 'warning',
        message: `${awaitingApproval} tác vụ AI chờ phê duyệt`,
        count: awaitingApproval,
      });
    if (returnRequests > 0)
      notifications.push({
        type: 'return_requests',
        severity: 'warning',
        message: `${returnRequests} yêu cầu hoàn hàng mới`,
        count: returnRequests,
      });

    return { notifications, total: notifications.reduce((s, n) => s + n.count, 0) };
  }
}
