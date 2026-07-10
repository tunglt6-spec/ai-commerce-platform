import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildOrderBy, paginate } from '../../common/dto/pagination.dto';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto/customer.dto';

const SORTABLE: Record<string, string> = {
  created_at: 'createdAt',
  lifetime_value: 'lifetimeValue',
  total_orders: 'totalOrders',
  last_purchase_at: 'lastPurchaseAt',
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({
        data: {
          tenantId,
          phone: dto.phone,
          email: dto.email ?? null,
          firstName: dto.first_name ?? null,
          lastName: dto.last_name ?? null,
          streetAddress: dto.street_address ?? null,
          ward: dto.ward ?? null,
          district: dto.district ?? null,
          city: dto.city ?? null,
          preferredSize: dto.preferred_size ?? null,
          notes: dto.notes ?? null,
          segment: 'New',
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A customer with this phone already exists in the tenant');
      }
      throw e;
    }
  }

  async findAll(tenantId: string, query: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = { tenantId };
    if (query.segment) where.segment = query.segment;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = buildOrderBy(query.sort, SORTABLE, { createdAt: 'desc' });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy, skip: query.skip, take: query.limit }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.first_name,
        lastName: dto.last_name,
        streetAddress: dto.street_address,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
        preferredSize: dto.preferred_size,
        notes: dto.notes,
      },
    });
  }
}
