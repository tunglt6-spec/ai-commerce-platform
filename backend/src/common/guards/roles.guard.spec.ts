import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES } from '../constants/roles';
import { AuthenticatedUser } from '../types/authenticated-user';

function ctx(user: Partial<AuthenticatedUser> | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('RolesGuard', () => {
  function guardWith(required: string[] | undefined) {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows when no roles required', () => {
    expect(guardWith(undefined).canActivate(ctx({ role: ROLES.VIEWER }))).toBe(true);
  });

  it('allows when role rank meets requirement', () => {
    const g = guardWith([ROLES.OPERATOR]);
    expect(g.canActivate(ctx({ role: ROLES.MANAGER, isPlatformAdmin: false }))).toBe(true);
  });

  it('denies when role rank is below requirement', () => {
    const g = guardWith([ROLES.MANAGER]);
    expect(() => g.canActivate(ctx({ role: ROLES.OPERATOR, isPlatformAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });

  it('platform admin bypasses tenant-role checks', () => {
    const g = guardWith([ROLES.ADMIN]);
    expect(g.canActivate(ctx({ role: ROLES.VIEWER, isPlatformAdmin: true }))).toBe(true);
  });

  it('denies when there is no authenticated user', () => {
    const g = guardWith([ROLES.VIEWER]);
    expect(() => g.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
