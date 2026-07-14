import { shouldBlockQuery, whereScopesToTenant, TENANT_SCOPED_MODELS } from './tenant-guard';
import { TenantStore } from '../context/tenant-context';

const authed: TenantStore = { tenantId: 't-1', isPlatformAdmin: false, bypass: false };

describe('tenant guard (defense-in-depth)', () => {
  describe('whereScopesToTenant (verifies VALUE, not just presence)', () => {
    it('accepts a matching scalar tenantId at top level or via AND', () => {
      expect(whereScopesToTenant({ tenantId: 't-1', status: 'x' }, 't-1')).toBe(true);
      expect(whereScopesToTenant({ AND: [{ status: 'x' }, { tenantId: 't-1' }] }, 't-1')).toBe(true);
    });
    it('REJECTS a tenantId belonging to another tenant (IDOR attempt)', () => {
      expect(whereScopesToTenant({ tenantId: 't-2' }, 't-1')).toBe(false);
    });
    it('rejects a non-scalar tenantId operator and OR-only nesting (fail-closed)', () => {
      expect(whereScopesToTenant({ tenantId: { in: ['t-1', 't-2'] } }, 't-1')).toBe(false);
      expect(whereScopesToTenant({ OR: [{ tenantId: 't-1' }] }, 't-1')).toBe(false);
    });
    it('rejects absent / empty', () => {
      expect(whereScopesToTenant({ status: 'active' }, 't-1')).toBe(false);
      expect(whereScopesToTenant(undefined as unknown, 't-1')).toBe(false);
    });
  });

  describe('shouldBlockQuery', () => {
    it('blocks a tenant-scoped set-op without a matching tenant filter', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: { status: 'active' } }, authed)).toBe(true);
      expect(shouldBlockQuery('Order', 'count', { where: {} }, authed)).toBe(true);
      expect(shouldBlockQuery('Customer', 'deleteMany', {}, authed)).toBe(true);
    });
    it('blocks a query scoped to ANOTHER tenant (horizontal IDOR)', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: { tenantId: 't-2' } }, authed)).toBe(true);
    });
    it('allows a query scoped to the caller tenant', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: { tenantId: 't-1', status: 'active' } }, authed)).toBe(false);
    });
    it('BLOCKS an unauthenticated request (tenantId null) on a tenant-scoped set-op (fail-closed)', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: { status: 'active' } }, { tenantId: null, isPlatformAdmin: false, bypass: false })).toBe(true);
    });
    it('ignores non-tenant models', () => {
      expect(shouldBlockQuery('User', 'findMany', { where: { email: 'a@b.c' } }, authed)).toBe(false);
    });
    it('ignores unique-key ops (findUnique/update/delete/create) — Prisma where cannot carry tenantId', () => {
      expect(shouldBlockQuery('Product', 'findUnique', { where: { id: 'x' } }, authed)).toBe(false);
      expect(shouldBlockQuery('Product', 'update', { where: { id: 'x' } }, authed)).toBe(false);
      expect(shouldBlockQuery('Product', 'delete', { where: { id: 'x' } }, authed)).toBe(false);
      expect(shouldBlockQuery('Product', 'create', {}, authed)).toBe(false);
    });
    it('ENFORCES findFirst (arbitrary where) — blocks unscoped, allows caller-scoped', () => {
      expect(shouldBlockQuery('Product', 'findFirst', { where: { id: 'x' } }, authed)).toBe(true);
      expect(shouldBlockQuery('Product', 'findFirst', { where: { id: 'x', tenantId: 't-1' } }, authed)).toBe(false);
    });
    it('allows platform admin, explicit bypass, and no-store (system/startup)', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, { tenantId: 't-1', isPlatformAdmin: true, bypass: false })).toBe(false);
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, { tenantId: null, isPlatformAdmin: false, bypass: true })).toBe(false);
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, undefined)).toBe(false);
    });
  });

  it('model set covers the known tenant-scoped tables', () => {
    ['Product', 'Order', 'Customer', 'Integration', 'CompliancePolicy'].forEach((m) => expect(TENANT_SCOPED_MODELS.has(m)).toBe(true));
  });
});
