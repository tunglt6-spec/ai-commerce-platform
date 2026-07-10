import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateFaqDto) {
    return this.prisma.faqItem.create({
      data: {
        tenantId,
        category: dto.category,
        question: dto.question,
        answer: dto.answer,
        priority: dto.priority ?? 0,
      },
    });
  }

  findAll(tenantId: string, category?: string) {
    return this.prisma.faqItem.findMany({
      where: { tenantId, ...(category ? { category } : {}) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async getScoped(tenantId: string, id: string) {
    const item = await this.prisma.faqItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('FAQ item not found');
    return item;
  }

  async update(tenantId: string, id: string, dto: UpdateFaqDto) {
    await this.getScoped(tenantId, id);
    return this.prisma.faqItem.update({
      where: { id },
      data: {
        category: dto.category,
        question: dto.question,
        answer: dto.answer,
        priority: dto.priority,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.getScoped(tenantId, id);
    await this.prisma.faqItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Text-based FAQ search (tenant-scoped, case-insensitive). This is the MVP
   * fallback; the schema keeps a `question_embedding vector(1536)` column so
   * semantic (pgvector) search can be layered in when an embeddings provider
   * is configured — without changing this contract.
   */
  async search(tenantId: string, query: string, limit = 5) {
    if (!query?.trim()) return [];
    // Token-based matching: any meaningful word (>=3 chars) in question or answer.
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .slice(0, 10);
    const terms = tokens.length > 0 ? tokens : [query.trim()];
    const or = terms.flatMap((t) => [
      { question: { contains: t, mode: 'insensitive' as const } },
      { answer: { contains: t, mode: 'insensitive' as const } },
    ]);
    return this.prisma.faqItem.findMany({
      where: { tenantId, OR: or },
      orderBy: { priority: 'desc' },
      take: limit,
    });
  }
}
