import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScoringService } from '../ai/agents/scoring.service';
import { buildOrderBy, paginate } from '../../common/dto/pagination.dto';
import {
  CreateProductDto,
  CreateVariantDto,
  ProductQueryDto,
  UpdateProductDto,
  UpdateStockDto,
} from './dto/product.dto';

const SORTABLE: Record<string, string> = {
  created_at: 'createdAt',
  product_score: 'productScore',
  retail_price: 'retailPrice',
  name: 'name',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  private computeScores(costPrice: number, retailPrice: number, tags: string[], hasImages: boolean) {
    return this.scoring.score({ costPrice, retailPrice, tags, hasImages });
  }

  async create(tenantId: string, dto: CreateProductDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.category_id, tenantId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('category_id does not belong to this tenant');

    const tags = dto.tags ?? [];
    const hasImages = !!dto.primary_image_url || (dto.image_urls?.length ?? 0) > 0;
    const s = this.computeScores(dto.cost_price, dto.retail_price, tags, hasImages);

    try {
      return await this.prisma.product.create({
        data: {
          tenantId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description ?? null,
          shortDescription: dto.short_description ?? null,
          categoryId: dto.category_id,
          costPrice: dto.cost_price,
          retailPrice: dto.retail_price,
          tags: tags as unknown as Prisma.InputJsonValue,
          primaryImageUrl: dto.primary_image_url ?? null,
          imageUrls: dto.image_urls ?? [],
          productScore: s.total_score,
          demandScore: s.demand_score,
          competitionScore: s.competition_score,
          profitMarginScore: s.profit_margin_score,
          contentViabilityScore: s.content_viability_score,
          riskScore: s.risk_score,
          scoreUpdatedAt: new Date(),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A product with this SKU already exists in the tenant');
      }
      throw e;
    }
  }

  async findAll(tenantId: string, query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = { tenantId };
    if (query.category_id) where.categoryId = query.category_id;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = buildOrderBy(query.sort, SORTABLE, { createdAt: 'desc' });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        variants: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.findOne(tenantId, id);

    if (dto.category_id) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.category_id, tenantId },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('category_id does not belong to this tenant');
    }

    const costPrice = dto.cost_price ?? Number(existing.costPrice);
    const retailPrice = dto.retail_price ?? Number(existing.retailPrice);
    const tags = dto.tags ?? (existing.tags as string[]);
    const priceOrTagChanged =
      dto.cost_price != null || dto.retail_price != null || dto.tags != null;
    const s = priceOrTagChanged
      ? this.computeScores(
          costPrice,
          retailPrice,
          Array.isArray(tags) ? tags : [],
          !!(dto.primary_image_url ?? existing.primaryImageUrl),
        )
      : null;

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        shortDescription: dto.short_description,
        categoryId: dto.category_id,
        costPrice: dto.cost_price,
        retailPrice: dto.retail_price,
        status: dto.status,
        tags: dto.tags ? (dto.tags as unknown as Prisma.InputJsonValue) : undefined,
        primaryImageUrl: dto.primary_image_url,
        imageUrls: dto.image_urls,
        ...(s
          ? {
              productScore: s.total_score,
              demandScore: s.demand_score,
              competitionScore: s.competition_score,
              profitMarginScore: s.profit_margin_score,
              contentViabilityScore: s.content_viability_score,
              riskScore: s.risk_score,
              scoreUpdatedAt: new Date(),
            }
          : {}),
      },
    });
  }

  async archive(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.product.update({
      where: { id },
      data: { status: 'archived' },
      select: { id: true, status: true },
    });
  }

  // ---- variants ----

  async createVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.findOne(tenantId, productId);
    const suffix = [dto.size, dto.color].filter(Boolean).join('-').toUpperCase() || 'DEFAULT';
    const variantSku = `${product.sku}-${suffix}`;

    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          variantSku,
          size: dto.size ?? null,
          color: dto.color ?? null,
          costPrice: dto.cost_price ?? null,
          retailPrice: dto.retail_price ?? null,
          stockQuantity: dto.stock_quantity ?? 0,
          reorderPoint: dto.reorder_point ?? 10,
        },
      });
      if ((dto.stock_quantity ?? 0) > 0) {
        await this.prisma.stockTransaction.create({
          data: {
            variantId: variant.id,
            quantityChange: dto.stock_quantity as number,
            reason: 'new_stock',
            notes: 'Initial variant stock',
          },
        });
      }
      return variant;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(`Variant ${variantSku} already exists`);
      }
      throw e;
    }
  }

  async updateStock(
    tenantId: string,
    productId: string,
    variantId: string,
    dto: UpdateStockDto,
    userId: string,
  ) {
    // Verify variant belongs to a product in this tenant.
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, product: { tenantId } },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const newQty = variant.stockQuantity + dto.quantity_change;
    if (newQty < 0) {
      throw new BadRequestException(
        `Insufficient stock: current ${variant.stockQuantity}, change ${dto.quantity_change}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newQty },
        select: { id: true, stockQuantity: true },
      });
      const trx = await tx.stockTransaction.create({
        data: {
          variantId,
          quantityChange: dto.quantity_change,
          reason: dto.reason,
          referenceId: dto.reference_id ?? null,
          notes: dto.notes ?? null,
          createdBy: userId,
        },
      });
      return { variant_id: updated.id, stock_quantity: updated.stockQuantity, transaction_id: trx.id };
    });
  }
}
