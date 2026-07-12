import { shouldBlockQuery, whereHasTenantScope, TENANT_SCOPED_MODELS } from './tenant-guard';
import { TenantStore } from '../context/tenant-context';

const authed: TenantStore = { tenantId: 't-1', isPlatformAdmin: false, bypass: false };

describe('tenant guard (defense-in-depth)', () => {
  describe('whereHasTenantScope', () => {
    it('detects top-level tenantId', () => expect(whereHasTenantScope({ tenantId: 't-1', status: 'x' })).toBe(true));
    it('detects tenantId nested in AND/OR', () => {
      expect(whereHasTenantScope({ AND: [{ status: 'x' }, { tenantId: 't-1' }] })).toBe(true);
      expect(whereHasTenantScope({ OR: [{ tenantId: 't-1' }] })).toBe(true);
    });
    it('returns false when absent', () => expect(whereHasTenantScope({ status: 'active' })).toBe(false));
    it('handles empty/undefined', () => {
      expect(whereHasTenantScope(undefined)).toBe(false);
      expect(whereHasTenantScope({})).toBe(false);
    });
  });

  describe('shouldBlockQuery', () => {
    it('blocks a tenant-scoped findMany without tenantId in an authed request', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: { status: 'active' } }, authed)).toBe(true);
      expect(shouldBlockQuery('Order', 'count', { where: {} }, authed)).toBe(true);
      expect(shouldBlockQuery('Customer', 'deleteMany', {}, authed)).toBe(true);
    });
    it('allows when tenantId is present', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: { tenantId: 't-1', status: 'active' } }, authed)).toBe(false);
    });
    it('ignores non-tenant models', () => {
      expect(shouldBlockQuery('User', 'findMany', { where: { email: 'a@b.c' } }, authed)).toBe(false);
    });
    it('ignores single-record ops (findUnique/findFirst/create)', () => {
      expect(shouldBlockQuery('Product', 'findUnique', { where: { id: 'x' } }, authed)).toBe(false);
      expect(shouldBlockQuery('Product', 'findFirst', { where: { id: 'x' } }, authed)).toBe(false);
      expect(shouldBlockQuery('Product', 'create', {}, authed)).toBe(false);
    });
    it('allows platform admin, bypass, and system (no tenant) contexts', () => {
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, { tenantId: 't-1', isPlatformAdmin: true, bypass: false })).toBe(false);
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, { tenantId: 't-1', isPlatformAdmin: false, bypass: true })).toBe(false);
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, { tenantId: null, isPlatformAdmin: false, bypass: false })).toBe(false);
      expect(shouldBlockQuery('Product', 'findMany', { where: {} }, undefined)).toBe(false);
    });
  });

  it('model set covers the known tenant-scoped tables', () => {
    ['Product', 'Order', 'Customer', 'Integration', 'CompliancePolicy'].forEach((m) => expect(TENANT_SCOPED_MODELS.has(m)).toBe(true));
  });
});
