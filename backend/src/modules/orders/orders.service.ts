import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildOrderBy, paginate } from '../../common/dto/pagination.dto';
import { buildOrderNumber } from '../../common/utils/order-number';
import { runWithoutTenantGuard } from '../../common/context/tenant-context';
import { CreateOrderDto, CreateShipmentDto, OrderQueryDto } from './dto/order.dto';
import { IntegrationsService } from '../integrations/integrations.service';

const SORTABLE: Record<string, string> = {
  created_at: 'createdAt',
  total_amount: 'totalAmount',
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  /**
   * Create an order. Stock is reserved (decremented) atomically at creation to
   * prevent overselling under concurrency. Cancelling restores stock.
   * (Reconciliation note vs FR-ORDER-002 which deducts at confirm: we reserve
   * earlier for correctness; confirm still gates fulfilment + payment.)
   */
  async create(tenantId: string, dto: CreateOrderDto, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customer_id, tenantId },
      select: { id: true },
    });
    if (!customer) throw new BadRequestException('customer_id does not belong to this tenant');

    // Load variants (tenant-scoped) and snapshot prices/names.
    const variantIds = dto.items.map((i) => i.variant_id);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { tenantId } },
      include: { product: { select: { name: true, retailPrice: true } } },
    });
    if (variants.length !== new Set(variantIds).size) {
      throw new BadRequestException('One or more variants not found in this tenant');
    }
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotal = new Prisma.Decimal(0);
    const itemsData = dto.items.map((item) => {
      const v = variantMap.get(item.variant_id)!;
      const unitPrice = v.retailPrice ?? v.product.retailPrice;
      const lineSubtotal = new Prisma.Decimal(unitPrice).mul(item.quantity);
      subtotal = subtotal.add(lineSubtotal);
      return {
        variantId: v.id,
        productName: v.product.name,
        variantName: [v.size, v.color].filter(Boolean).join(' - ') || null,
        unitPrice: new Prisma.Decimal(unitPrice),
        quantity: item.quantity,
        subtotal: lineSubtotal,
      };
    });

    const discount = new Prisma.Decimal(dto.discount_amount ?? 0);
    const shipping = new Prisma.Decimal(dto.shipping_cost ?? 0);
    const total = subtotal.sub(discount).add(shipping);
    if (total.lessThan(0)) throw new BadRequestException('Total amount cannot be negative');

    // Aggregate quantities per variant (in case of duplicate lines).
    const qtyByVariant = new Map<string, number>();
    for (const it of dto.items) {
      qtyByVariant.set(it.variant_id, (qtyByVariant.get(it.variant_id) ?? 0) + it.quantity);
    }

    const order = await this.createWithRetry(async (orderNumber) =>
      this.prisma.$transaction(async (tx) => {
        // Atomic stock reservation — updateMany with guard prevents oversell.
        for (const [variantId, qty] of qtyByVariant) {
          const res = await tx.productVariant.updateMany({
            where: { id: variantId, stockQuantity: { gte: qty } },
            data: { stockQuantity: { decrement: qty } },
          });
          if (res.count === 0) {
            const v = variantMap.get(variantId)!;
            throw new BadRequestException(
              `Insufficient stock for ${v.variantSku} (requested ${qty})`,
            );
          }
        }

        const order = await tx.order.create({
          data: {
            tenantId,
            orderNumber,
            customerId: dto.customer_id,
            subtotal,
            discountAmount: discount,
            shippingCost: shipping,
            totalAmount: total,
            shippingAddress: dto.shipping_address,
            shippingMethod: dto.shipping_method ?? null,
            customerNotes: dto.customer_notes ?? null,
            createdBy: userId,
            items: { create: itemsData },
          },
          include: { items: true },
        });

        // Stock transaction log for each reserved variant.
        for (const [variantId, qty] of qtyByVariant) {
          await tx.stockTransaction.create({
            data: {
              variantId,
              quantityChange: -qty,
              reason: 'sold',
              referenceId: order.id,
              createdBy: userId,
              notes: `Order ${orderNumber}`,
            },
          });
        }

        // Update customer aggregates.
        await tx.customer.update({
          where: { id: dto.customer_id },
          data: {
            totalOrders: { increment: 1 },
            lifetimeValue: { increment: total },
            lastPurchaseAt: new Date(),
          },
        });

        return order;
      }),
    );

    // Notify connected integrations (real outbound webhook, fire-and-forget).
    void this.integrations
      .dispatchEvent(tenantId, 'order.created', {
        order_id: order.id,
        order_number: order.orderNumber,
        total_amount: Number(order.totalAmount),
      })
      .catch(() => undefined);

    return order;
  }

  async findAll(tenantId: string, query: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = { tenantId };
    if (query.status) where.status = query.status;
    if (query.customer_id) where.customerId = query.customer_id;
    if (query.search) where.orderNumber = { contains: query.search, mode: 'insensitive' };
    const orderBy = buildOrderBy(query.sort, SORTABLE, { createdAt: 'desc' });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        items: true,
        payments: true,
        returns: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async confirm(tenantId: string, id: string) {
    const order = await this.findOne(tenantId, id);
    if (order.status !== 'pending') {
      throw new ConflictException(`Only pending orders can be confirmed (current: ${order.status})`);
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date() },
      select: { id: true, status: true, confirmedAt: true },
    });
  }

  async ship(tenantId: string, id: string, dto: CreateShipmentDto) {
    const order = await this.findOne(tenantId, id);
    if (!['confirmed', 'packed'].includes(order.status)) {
      throw new ConflictException(
        `Order must be confirmed/packed before shipping (current: ${order.status})`,
      );
    }
    const trackingNumber = `TRK${Date.now().toString(36).toUpperCase()}${Math.floor(
      1000 + Math.random() * 9000,
    )}`;
    const estimated = new Date();
    estimated.setDate(estimated.getDate() + 2);

    return this.prisma.order.update({
      where: { id },
      data: {
        status: 'shipped',
        shippingMethod: dto.shipping_method ?? order.shippingMethod,
        trackingNumber,
        estimatedDeliveryDate: estimated,
        shippedAt: new Date(),
      },
      select: { id: true, status: true, trackingNumber: true, estimatedDeliveryDate: true },
    });
  }

  async cancel(tenantId: string, id: string) {
    const order = await this.findOne(tenantId, id);
    if (['shipped', 'delivered', 'completed', 'cancelled', 'returned'].includes(order.status)) {
      throw new ConflictException(`Cannot cancel an order in status ${order.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Restore reserved stock.
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        await tx.stockTransaction.create({
          data: {
            variantId: item.variantId,
            quantityChange: item.quantity,
            reason: 'return',
            referenceId: order.id,
            notes: `Cancel order ${order.orderNumber}`,
          },
        });
      }
      // Reverse customer aggregates.
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          totalOrders: { decrement: 1 },
          lifetimeValue: { decrement: order.totalAmount },
        },
      });
      return tx.order.update({
        where: { id },
        data: { status: 'cancelled' },
        select: { id: true, status: true },
      });
    });
  }

  // ---- helpers ----

  /** Retry order-number generation on unique collision (concurrent same-day inserts). */
  private async createWithRetry<T>(fn: (orderNumber: string) => Promise<T>): Promise<T> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let attempt = 0; attempt < 5; attempt++) {
      // Global daily sequence for the globally-unique orderNumber — intentionally
      // cross-tenant, so it runs outside the tenant guard.
      const dailyCount = await runWithoutTenantGuard(() =>
        this.prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      );
      const orderNumber = buildOrderNumber(dailyCount + 1 + attempt, now);
      try {
        return await fn(orderNumber);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue; // collision — retry with next sequence
        }
        throw e;
      }
    }
    throw new ConflictException('Could not allocate a unique order number, please retry');
  }
}
