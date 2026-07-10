/** Tenant-scoped roles (stored in user_tenants.role). */
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Higher number = more privilege. Used for hierarchical checks. */
export const ROLE_RANK: Record<Role, number> = {
  [ROLES.VIEWER]: 1,
  [ROLES.OPERATOR]: 2,
  [ROLES.MANAGER]: 3,
  [ROLES.ADMIN]: 4,
};

export const ALL_ROLES: Role[] = [ROLES.VIEWER, ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN];

export function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}
