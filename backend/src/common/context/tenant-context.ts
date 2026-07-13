import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant context. Established once per HTTP request by
 * TenantContextMiddleware, then populated with the authenticated tenant by the
 * JWT strategy. The Prisma tenant guard reads it to fail-closed on tenant-scoped
 * queries that lack a tenant filter — a second isolation layer behind the
 * application's explicit `where: { tenantId }` scoping.
 */
export interface TenantStore {
  tenantId: string | null;
  isPlatformAdmin: boolean;
  bypass: boolean;
}

const als = new AsyncLocalStorage<TenantStore>();

/** Wrap the remainder of a request in a fresh tenant context. */
export function runWithTenantContext<T>(fn: () => T): T {
  return als.run({ tenantId: null, isPlatformAdmin: false, bypass: false }, fn);
}

export function getTenantStore(): TenantStore | undefined {
  return als.getStore();
}

/** Populate the current context with the authenticated principal (called post-auth). */
export function setTenant(tenantId: string, isPlatformAdmin: boolean): void {
  const s = als.getStore();
  if (s) {
    s.tenantId = tenantId;
    s.isPlatformAdmin = isPlatformAdmin;
  }
}

/**
 * Run a function with the tenant guard temporarily disabled — for the rare, legitimate
 * system/cross-tenant path (e.g. a scheduler scanning every tenant). Use sparingly.
 */
export async function runWithoutTenantGuard<T>(fn: () => Promise<T>): Promise<T> {
  const s = als.getStore();
  // Run in a NESTED context with bypass=true rather than mutating the shared store —
  // so a concurrent sibling (e.g. inside a Promise.all in the same request) never observes
  // the bypass flag. The bypass applies only to the async scope of fn.
  const base: TenantStore = s
    ? { tenantId: s.tenantId, isPlatformAdmin: s.isPlatformAdmin, bypass: true }
    : { tenantId: null, isPlatformAdmin: false, bypass: true };
  return als.run(base, fn);
}
