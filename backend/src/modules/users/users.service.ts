import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, isRole } from '../../common/constants/roles';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const membership = await this.prisma.userTenant.findFirst({
      where: { userId, tenantId },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });
    return { ...user, tenant, tenant_role: membership?.role };
  }

  /** List members of the current tenant. */
  async listTenantMembers(tenantId: string) {
    const members = await this.prisma.userTenant.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, email: true, username: true, firstName: true, lastName: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      user_id: m.userId,
      role: m.role,
      email: m.user.email,
      username: m.user.username,
      first_name: m.user.firstName,
      last_name: m.user.lastName,
      is_active: m.user.isActive,
    }));
  }

  /** Change a member's role within the current tenant (admin only). */
  async updateMemberRole(tenantId: string, targetUserId: string, role: string) {
    if (!isRole(role)) {
      throw new BadRequestException('Invalid role');
    }
    const membership = await this.prisma.userTenant.findFirst({
      where: { tenantId, userId: targetUserId },
    });
    if (!membership) throw new NotFoundException('Member not found in this tenant');

    await this.prisma.userTenant.update({
      where: { id: membership.id },
      data: { role: role as Role },
    });
    return { user_id: targetUserId, tenant_id: tenantId, role };
  }
}
