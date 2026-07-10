import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, ROLES } from '../../common/constants/roles';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const slug = await this.uniqueSlug(dto.tenant_name || `${dto.username}-store`);

    // Create user + their first tenant + admin membership atomically.
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          firstName: dto.first_name ?? null,
          lastName: dto.last_name ?? null,
          role: 'operator',
        },
      });
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenant_name || `${dto.username}'s Store`,
          slug,
          ownerId: u.id,
        },
      });
      await tx.userTenant.create({
        data: { userId: u.id, tenantId: tenant.id, role: ROLES.ADMIN },
      });
      return u;
    });

    return {
      user_id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = await this.resolveMembership(user.id, dto.tenant_id);
    if (!membership) {
      throw new UnauthorizedException('User has no tenant membership');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens({
      userId: user.id,
      tenantId: membership.tenantId,
      role: membership.role as Role,
      email: user.email,
      isPlatformAdmin: user.role === 'admin',
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: membership.role,
        tenant_id: membership.tenantId,
      },
    };
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = this.hashToken(dto.refresh_token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!record.user.isActive) {
      throw new UnauthorizedException('User inactive');
    }
    const membership = await this.resolveMembership(record.userId, record.tenantId ?? undefined);
    if (!membership) {
      throw new UnauthorizedException('User has no tenant membership');
    }

    // Rotate: revoke the used token, issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({
      userId: record.userId,
      tenantId: membership.tenantId,
      role: membership.role as Role,
      email: record.user.email,
      isPlatformAdmin: record.user.role === 'admin',
    });
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all refresh tokens so every session must re-authenticate with the new password.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Password changed successfully. Please sign in again.' };
  }

  // ---- helpers ----

  private async resolveMembership(userId: string, tenantId?: string) {
    if (tenantId) {
      return this.prisma.userTenant.findFirst({ where: { userId, tenantId } });
    }
    return this.prisma.userTenant.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async issueTokens(principal: {
    userId: string;
    tenantId: string;
    role: Role;
    email: string;
    isPlatformAdmin: boolean;
  }) {
    const accessTtl = this.config.get<number>('jwt.accessTtl') as number;
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') as number;

    const access_token = await this.jwt.signAsync(
      {
        sub: principal.userId,
        tenantId: principal.tenantId,
        role: principal.role,
        email: principal.email,
        isPlatformAdmin: principal.isPlatformAdmin,
        type: 'access',
      },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: accessTtl,
      },
    );

    // Refresh token is an opaque random string; only its hash is stored.
    const refresh_token = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: principal.userId,
        tenantId: principal.tenantId,
        tokenHash: this.hashToken(refresh_token),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { access_token, refresh_token, expires_in: accessTtl, token_type: 'Bearer' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'store';
    let slug = root;
    let i = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${root}-${i++}`;
    }
    return slug;
  }
}
