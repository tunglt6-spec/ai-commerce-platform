import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'category'
    );
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        iconUrl: dto.icon_url ?? null,
        parentId: dto.parent_id ?? null,
        displayOrder: dto.display_order ?? 0,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(tenantId, id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        iconUrl: dto.icon_url,
        displayOrder: dto.display_order,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const productCount = await this.prisma.product.count({ where: { categoryId: id, tenantId } });
    if (productCount > 0) {
      throw new NotFoundException(
        'Cannot delete a category that still has products; reassign them first',
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }
}
