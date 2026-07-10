import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildOrderBy, paginate } from '../../common/dto/pagination.dto';
import {
  ApproveContentDto,
  ContentQueryDto,
  CreateContentDto,
  ScheduleContentDto,
} from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateContentDto) {
    if (dto.product_id) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.product_id, tenantId },
        select: { id: true },
      });
      if (!product) throw new BadRequestException('product_id does not belong to this tenant');
    }
    return this.prisma.contentAsset.create({
      data: {
        tenantId,
        productId: dto.product_id ?? null,
        contentType: dto.content_type,
        platform: dto.platform ?? null,
        title: dto.title ?? null,
        content: dto.content,
        aiGenerated: dto.ai_generated ?? false,
        aiModelUsed: dto.ai_model_used ?? null,
        status: 'draft',
      },
    });
  }

  async findAll(tenantId: string, query: ContentQueryDto) {
    const where: Prisma.ContentAssetWhereInput = { tenantId };
    if (query.status) where.status = query.status;
    if (query.content_type) where.contentType = query.content_type;
    const orderBy = buildOrderBy(query.sort, { created_at: 'createdAt' }, { createdAt: 'desc' });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contentAsset.findMany({ where, orderBy, skip: query.skip, take: query.limit }),
      this.prisma.contentAsset.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  private async getScoped(tenantId: string, id: string) {
    const asset = await this.prisma.contentAsset.findFirst({ where: { id, tenantId } });
    if (!asset) throw new NotFoundException('Content asset not found');
    return asset;
  }

  async submitForReview(tenantId: string, id: string) {
    await this.getScoped(tenantId, id);
    return this.prisma.contentAsset.update({
      where: { id },
      data: { status: 'pending_review' },
    });
  }

  async approve(tenantId: string, id: string, userId: string, dto: ApproveContentDto) {
    const asset = await this.getScoped(tenantId, id);
    if (asset.status !== 'pending_review') {
      throw new BadRequestException(`Content must be pending_review to approve/reject (current: ${asset.status})`);
    }
    return this.prisma.contentAsset.update({
      where: { id },
      data: {
        status: dto.approved ? 'approved' : 'draft',
        approvalNotes: dto.notes ?? null,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    });
  }

  async schedule(tenantId: string, id: string, dto: ScheduleContentDto) {
    const asset = await this.getScoped(tenantId, id);
    if (asset.status !== 'approved') {
      throw new BadRequestException('Only approved content can be scheduled');
    }
    return this.prisma.contentCalendar.create({
      data: {
        tenantId,
        contentAssetId: id,
        scheduledDate: new Date(dto.scheduled_date),
        scheduledTime: dto.scheduled_time ?? null,
        status: 'scheduled',
      },
    });
  }

  async calendar(tenantId: string) {
    return this.prisma.contentCalendar.findMany({
      where: { tenantId },
      orderBy: { scheduledDate: 'asc' },
      include: {
        contentAsset: { select: { title: true, contentType: true, platform: true, status: true } },
      },
      take: 200,
    });
  }
}
