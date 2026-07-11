'use client';

import { useAuth } from '@/store/auth';

export const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  operator: 2,
  manager: 3,
  admin: 4,
};

export function roleAtLeast(role: string | undefined, min: 'viewer' | 'operator' | 'manager' | 'admin') {
  return (ROLE_RANK[role ?? ''] ?? 0) >= ROLE_RANK[min];
}

/** Convenience hook: permission flags for the current tenant role. Mirrors the
 *  backend RBAC hierarchy — the backend remains authoritative; this only controls
 *  what the UI shows/enables. */
export function usePermissions() {
  const role = useAuth((s) => s.user?.role);
  return {
    role,
    canOperate: roleAtLeast(role, 'operator'),
    canManage: roleAtLeast(role, 'manager'),
    canAdmin: roleAtLeast(role, 'admin'),
  };
}
