import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateTenantDto } from './dto/tenant.dto';

const PROFILE_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  createdAt: true,
} as const;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: PROFILE_SELECT });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateProfile(tenantId: string, dto: UpdateTenantDto) {
    await this.getProfile(tenantId); // ensures the tenant exists / is scoped
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.logo_url !== undefined ? { logoUrl: dto.logo_url } : {}),
      },
      select: PROFILE_SELECT,
    });
  }
}
