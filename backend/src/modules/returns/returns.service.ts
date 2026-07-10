import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildOrderBy, paginate } from '../../common/dto/pagination.dto';
import { CreateReturnDto, ReturnQueryDto, UpdateReturnDto } from './dto/return.dto';

const RETURNABLE_ORDER_STATUSES = ['shipped', 'delivered', 'completed'];

// Allowed forward transitions for a return.
const TRANSITIONS: Record<string, string[]> = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'refunded'],
  received: ['refunded'],
  rejected: [],
  refunded: [],
};

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async request(tenantId: string, orderId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!RETURNABLE_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException(`Order in status ${order.status} is not eligible for return`);
    }
    const existing = await this.prisma.return.findFirst({
      where: { orderId, status: { in: ['requested', 'approved', 'received'] } },
    });
    if (existing) throw new ConflictException('An active return already exists for this order');

    return this.prisma.return.create({
      data: {
        orderId,
        reason: dto.reason,
        description: dto.description ?? null,
        status: 'requested',
      },
    });
  }

  async findAll(tenantId: string, query: ReturnQueryDto) {
    const where: Prisma.ReturnWhereInput = { order: { tenantId } };
    if (query.status) where.status = query.status;
    const orderBy = buildOrderBy(query.sort, { created_at: 'createdAt' }, { createdAt: 'desc' });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: { order: { select: { orderNumber: true, totalAmount: true } } },
      }),
      this.prisma.return.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  private async getScoped(tenantId: string, id: string) {
    const ret = await this.prisma.return.findFirst({
      where: { id, order: { tenantId } },
      include: { order: { include: { items: true } } },
    });
    if (!ret) throw new NotFoundException('Return not found');
    return ret;
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateReturnDto) {
    const ret = await this.getScoped(tenantId, id);
    const allowed = TRANSITIONS[ret.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(`Cannot transition return from ${ret.status} to ${dto.status}`);
    }

    if (dto.status !== 'refunded') {
      return this.prisma.return.update({
        where: { id },
        data: { status: dto.status },
      });
    }

    // Refund: restore stock, mark order returned/refunded, log finance + stock txns.
    const refundAmount = new Prisma.Decimal(dto.refund_amount ?? Number(ret.order.totalAmount));
    return this.prisma.$transaction(async (tx) => {
      for (const item of ret.order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        await tx.stockTransaction.create({
          data: {
            variantId: item.variantId,
            quantityChange: item.quantity,
            reason: 'return',
            referenceId: ret.order.id,
            notes: `Return ${id} for order ${ret.order.orderNumber}`,
          },
        });
      }
      await tx.order.update({
        where: { id: ret.orderId },
        data: { status: 'returned', paymentStatus: 'refunded' },
      });
      await tx.customer.update({
        where: { id: ret.order.customerId },
        data: { lifetimeValue: { decrement: refundAmount } },
      });
      await tx.financialTransaction.create({
        data: {
          tenantId,
          transactionType: 'refund',
          category: 'returns',
          amount: refundAmount,
          referenceId: ret.order.id,
          description: `Refund for return ${id}`,
        },
      });
      return tx.return.update({
        where: { id },
        data: { status: 'refunded', refundAmount, refundedAt: new Date() },
      });
    });
  }
}
