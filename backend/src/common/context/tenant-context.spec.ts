import { runWithTenantContext, runWithoutTenantGuard, setTenant, getTenantStore } from './tenant-context';

describe('tenant-context', () => {
  it('setTenant populates the current request store', async () => {
    await runWithTenantContext(async () => {
      setTenant('t-1', false);
      expect(getTenantStore()?.tenantId).toBe('t-1');
      expect(getTenantStore()?.bypass).toBe(false);
    });
  });

  it('runWithoutTenantGuard keeps bypass across an async gap (lazy-promise safe) and does not leak out', async () => {
    await runWithTenantContext(async () => {
      setTenant('t-1', false);
      let bypassInside = false;
      await runWithoutTenantGuard(async () => {
        await new Promise((r) => setTimeout(r, 1)); // simulate a deferred/lazy query
        bypassInside = getTenantStore()?.bypass === true;
      });
      expect(bypassInside).toBe(true); // bypass active for the whole fn, incl. after await
      // Outside the helper: the request store is unchanged (no shared-store mutation).
      expect(getTenantStore()?.bypass).toBe(false);
      expect(getTenantStore()?.tenantId).toBe('t-1');
    });
  });

  it('a concurrent sibling does NOT observe the bypass (per-scope isolation)', async () => {
    await runWithTenantContext(async () => {
      setTenant('t-1', false);
      const sibling = (async () => {
        await new Promise((r) => setTimeout(r, 1));
        return getTenantStore()?.bypass; // should stay false
      })();
      await runWithoutTenantGuard(async () => {
        await new Promise((r) => setTimeout(r, 2));
      });
      expect(await sibling).toBe(false);
    });
  });
});
