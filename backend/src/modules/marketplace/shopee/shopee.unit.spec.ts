import { createHmac } from 'crypto';
import { ShopeeConfig } from './shopee.config';
import { ShopeeAdapterService } from './shopee-adapter.service';
import { ShopeeService, buildAddItemBody, CreateListingInput } from './shopee.service';

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

  describe('buildAddItemBody (pure, deterministic)', () => {
    const base: CreateListingInput = {
      name: 'Vợt Pickleball Carbon',
      description: 'Vợt carbon 3K, êm tay',
      categoryId: 100182,
      price: 850000,
      stock: 12,
      weightKg: 0.25,
      imageIds: ['img_a', 'img_b'],
      logistics: [
        { logistic_id: 90003, enabled: true, is_free: true },
        { logistic_id: 90005, enabled: false },
      ],
    };

    it('maps core fields and only keeps enabled logistics channels', () => {
      const body: any = buildAddItemBody(base);
      expect(body.item_name).toBe('Vợt Pickleball Carbon');
      expect(body.category_id).toBe(100182);
      expect(body.original_price).toBe(850000);
      expect(body.seller_stock).toEqual([{ stock: 12 }]);
      expect(body.image.image_id_list).toEqual(['img_a', 'img_b']);
      expect(body.logistic_info).toEqual([{ logistic_id: 90003, enabled: true, is_free: true }]);
      expect(body.item_status).toBe('NORMAL');
      expect(body.condition).toBe('NEW');
      expect(body.pre_order).toEqual({ is_pre_order: false, days_to_ship: 3 });
    });

    it('applies safe defaults for weight/dimension and caps images at 9', () => {
      const body: any = buildAddItemBody({ ...base, weightKg: 0, imageIds: Array.from({ length: 15 }, (_, i) => `i${i}`), dimensionCm: undefined });
      expect(body.weight).toBe(0.1);
      expect(body.dimension).toEqual({ package_length: 10, package_width: 10, package_height: 10 });
      expect(body.image.image_id_list).toHaveLength(9);
    });

    it('includes brand only when supplied', () => {
      expect((buildAddItemBody(base) as any).brand).toBeUndefined();
      const withBrand: any = buildAddItemBody({ ...base, brand: { brand_id: 7, original_brand_name: 'X' } });
      expect(withBrand.brand).toEqual({ brand_id: 7, original_brand_name: 'X' });
    });
  });

  describe('listing helper adapters (mocked HTTP)', () => {
    const realFetch = global.fetch;
    afterEach(() => {
      global.fetch = realFetch;
    });

    it('getLogisticsChannels calls get_channel_list and returns data', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ response: { logistics_channel_list: [{ logistics_channel_id: 90003 }] } }) });
      global.fetch = fetchMock as any;
      const res = await adapter().getLogisticsChannels('999', 'ACCESS');
      expect(res.ok).toBe(true);
      expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/logistics/get_channel_list');
    });

    it('uploadImageFromUrl fetches bytes then returns image_id', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => '3' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ response: { image_info: { image_id: 'IMG_XYZ' } } }) });
      global.fetch = fetchMock as any;
      // Public IP-literal host: passes the SSRF guard without a DNS lookup; fetch is mocked.
      const res = await adapter().uploadImageFromUrl('999', 'ACCESS', 'https://93.184.216.34/pic.jpg');
      expect(res.ok).toBe(true);
      expect(res.imageId).toBe('IMG_XYZ');
      expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v2/media_space/upload_image');
    });

    it('uploadImageFromUrl fails-closed when image fetch errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
      const res = await adapter().uploadImageFromUrl('999', 'ACCESS', 'https://93.184.216.34/missing.jpg');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('IMAGE_FETCH_404');
    });

    it('uploadImageFromUrl fails-closed (SSRF) for a private/metadata image URL', async () => {
      global.fetch = jest.fn() as any;
      const res = await adapter().uploadImageFromUrl('999', 'ACCESS', 'http://169.254.169.254/latest/meta-data/');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('SSRF_BLOCKED');
      expect((global.fetch as any)).not.toHaveBeenCalled();
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
