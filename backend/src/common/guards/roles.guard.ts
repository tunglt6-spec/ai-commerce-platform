import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role, ROLE_RANK } from '../constants/roles';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Authorization guard. Enforces @Roles(...) using role hierarchy: a caller
 * whose role rank >= the lowest required role rank is allowed. Platform admins
 * bypass tenant-role checks. Backend enforcement is authoritative — never rely
 * on the frontend to hide actions.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser;
    if (!user) throw new ForbiddenException('Missing authenticated user');
    if (user.isPlatformAdmin) return true;

    const minRequiredRank = Math.min(...required.map((r) => ROLE_RANK[r]));
    if (ROLE_RANK[user.role] >= minRequiredRank) return true;

    throw new ForbiddenException('Insufficient permissions for this action');
  }
}
