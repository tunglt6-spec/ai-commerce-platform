import { createHmac } from 'crypto';
import { ShopeeConfig } from './shopee.config';
import { ShopeeAdapterService } from './shopee-adapter.service';
import { ShopeeService } from './shopee.service';

describe('Shopee adapter (unit, deterministic)', () => {
  const PID = '123456';
  const KEY = 'shpk_test_partner_key';

  beforeAll(() => {
    process.env.SHOPEE_PARTNER_ID = PID;
    process.env.SHOPEE_PARTNER_KEY = KEY;
    process.env.SHOPEE_API_BASE = 'https://partner.shopeemobile.com';
    process.env.SHOPEE_REDIRECT_URL = 'https://store.picklefund.uk/api/v1/marketplace/shopee/callback';
    process.env.INTEGRATION_ENC_KEY = 'x'.repeat(32);
  });

  const cfg = () => new ShopeeConfig();
  const adapter = () => new ShopeeAdapterService(cfg());

  describe('v2 HMAC-SHA256 signing', () => {
    const ts = 1700000000;
    const path = '/api/v2/shop/get_shop_info';

    it('signs public base = partnerId+path+timestamp', () => {
      const expected = createHmac('sha256', KEY).update(`${PID}${path}${ts}`).digest('hex');
      expect(adapter().sign(path, ts)).toBe(expected);
    });

    it('signs shop base = partnerId+path+timestamp+accessToken+shopId', () => {
      const expected = createHmac('sha256', KEY).update(`${PID}${path}${ts}ACCESS999`).digest('hex');
      expect(adapter().sign(path, ts, 'ACCESS', '999')).toBe(expected);
    });

    it('public and shop signatures differ', () => {
      expect(adapter().sign(path, ts)).not.toBe(adapter().sign(path, ts, 'ACCESS', '999'));
    });
  });

  describe('buildAuthUrl', () => {
    it('includes partner_id, sign, and the redirect', () => {
      const url = adapter().buildAuthUrl('https://store.picklefund.uk/api/v1/marketplace/shopee/callback/STATE');
      expect(url).toContain('https://partner.shopeemobile.com/api/v2/shop/auth_partner');
      expect(url).toContain(`partner_id=${PID}`);
      expect(url).toContain('sign=');
      expect(url).toContain('redirect=https%3A%2F%2Fstore.picklefund.uk');
    });
  });

  describe('config gating', () => {
    it('isConfigured true when both id+key present', () => {
      expect(cfg().isConfigured).toBe(true);
    });
    it('adapter fails-closed (no fake success) when not configured', async () => {
      const notConfigured = { isConfigured: false } as unknown as ShopeeConfig;
      const a = new ShopeeAdapterService(notConfigured);
      const res = await a.getShopInfo('1', 'tok');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('SHOPEE_NOT_CONFIGURED');
    });
  });

  describe('token exchange (mocked HTTP)', () => {
    const realFetch = global.fetch;
    afterEach(() => {
      global.fetch = realFetch;
    });

    it('parses tokens on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'A', refresh_token: 'R', expire_in: 14400 }),
      }) as any;
      const out = await adapter().getTokens('code123', '999');
      expect(out.ok).toBe(true);
      expect(out.accessToken).toBe('A');
      expect(out.refreshToken).toBe('R');
      expect(out.expireIn).toBe(14400);
    });

    it('treats a Shopee `error` field as failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ error: 'invalid_code', message: 'bad code' }),
      }) as any;
      const out = await adapter().getTokens('bad', '999');
      expect(out.ok).toBe(false);
      expect(out.error).toBe('invalid_code');
    });
  });

  describe('ShopeeService signed state (tenant carrier for JWT-less OAuth)', () => {
    const svc = () => new ShopeeService(null as any, null as any, null as any, cfg());

    it('round-trips the tenant id', () => {
      const s = svc();
      const state = s.signState('tenant-abc');
      expect(s.verifyState(state)).toBe('tenant-abc');
    });

    it('rejects a tampered state', () => {
      const s = svc();
      const state = s.signState('tenant-abc');
      const tampered = Buffer.from(
        Buffer.from(state, 'base64url').toString('utf8').replace('tenant-abc', 'tenant-evil'),
      ).toString('base64url');
      expect(() => s.verifyState(tampered)).toThrow();
    });
  });
});
