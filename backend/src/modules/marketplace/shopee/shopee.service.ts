import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { ShopeeAdapterService } from './shopee-adapter.service';
import { ShopeeConfig } from './shopee.config';

const PROVIDER = 'shopee';
const STATE_TTL_SEC = 900; // 15 min
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh 5 min before expiry

interface StoredTokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class ShopeeService {
  private readonly logger = new Logger(ShopeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly adapter: ShopeeAdapterService,
    private readonly config: ShopeeConfig,
  ) {}

  private get stateSecret(): string {
    return process.env.INTEGRATION_ENC_KEY || 'shopee-state-secret';
  }

  /** Signed, short-lived state so the JWT-less OAuth callback maps back to a tenant. */
  signState(tenantId: string): string {
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SEC;
    const payload = `${tenantId}.${exp}`;
    const sig = createHmac('sha256', this.stateSecret).update(payload).digest('hex');
    return Buffer.from(`${payload}.${sig}`).toString('base64url');
  }

  verifyState(state: string): string {
    let decoded: string;
    try {
      decoded = Buffer.from(state, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('State không hợp lệ');
    }
    const parts = decoded.split('.');
    if (parts.length !== 3) throw new BadRequestException('State không hợp lệ');
    const [tenantId, expStr, sig] = parts;
    const expected = createHmac('sha256', this.stateSecret).update(`${tenantId}.${expStr}`).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('State sai chữ ký');
    if (Number(expStr) * 1000 < Date.now()) throw new BadRequestException('State đã hết hạn — hãy cấp quyền lại');
    return tenantId;
  }

  /** URL the admin opens to authorize a Shopee shop for this tenant. */
  getAuthUrl(tenantId: string): { url: string } {
    if (!this.config.isConfigured) {
      throw new BadRequestException('Shopee chưa được cấu hình (thiếu SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY trên máy chủ).');
    }
    const state = this.signState(tenantId);
    const redirect = `${this.config.redirectUrl}/${state}`;
    return { url: this.adapter.buildAuthUrl(redirect) };
  }

  private appOrigin(): string {
    return this.config.redirectUrl.replace(/\/api\/v1.*$/, '');
  }

  /** OAuth return: exchange code for tokens and store them for the tenant. Returns a redirect target. */
  async handleCallback(state: string, code: string, shopId: string): Promise<string> {
    const origin = this.appOrigin();
    try {
      const tenantId = this.verifyState(state);
      if (!code || !shopId) throw new BadRequestException('Thiếu code hoặc shop_id từ Shopee');
      const tok = await this.adapter.getTokens(code, shopId);
      if (!tok.ok || !tok.accessToken) {
        await this.markError(tenantId, `Lấy token thất bại: ${tok.error}`);
        return `${origin}/integrations/shopee?shopee=error`;
      }
      await this.persistTokens(tenantId, shopId, tok.accessToken, tok.refreshToken!, tok.expireIn ?? 14400);
      return `${origin}/integrations/shopee?shopee=connected`;
    } catch (e) {
      this.logger.warn(`Shopee callback error: ${(e as Error).message}`);
      return `${origin}/integrations/shopee?shopee=error`;
    }
  }

  private async persistTokens(tenantId: string, shopId: string, accessToken: string, refreshToken: string, expireIn: number) {
    const secretRef = this.encryption.encrypt(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken } as StoredTokens));
    const expireAt = new Date(Date.now() + expireIn * 1000);
    await this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId, provider: PROVIDER } },
      create: { tenantId, provider: PROVIDER, status: 'connected', secretRef, connectedAt: new Date(), expiresAt: expireAt, config: { shop_id: shopId }, isActive: true },
      update: { status: 'connected', secretRef, connectedAt: new Date(), expiresAt: expireAt, config: { shop_id: shopId }, lastError: null, isActive: true },
    });
  }

  private async markError(tenantId: string, message: string) {
    await this.prisma.integration
      .updateMany({ where: { tenantId, provider: PROVIDER }, data: { status: 'error', lastError: message } })
      .catch(() => null);
  }

  private async record(tenantId: string) {
    const rec = await this.prisma.integration.findFirst({ where: { tenantId, provider: PROVIDER } });
    return rec;
  }

  /** Returns a valid access token + shop id, refreshing if near expiry. */
  private async getValidToken(tenantId: string): Promise<{ accessToken: string; shopId: string }> {
    const rec = await this.record(tenantId);
    if (!rec || !rec.secretRef) throw new BadRequestException('Chưa kết nối Shopee — hãy cấp quyền cửa hàng trước.');
    const cfg = (rec.config as Record<string, unknown>) ?? {};
    const shopId = String(cfg.shop_id ?? '');
    if (!shopId) throw new BadRequestException('Thiếu shop_id — cấp quyền lại.');
    let tokens = JSON.parse(this.encryption.decrypt(rec.secretRef)) as StoredTokens;

    const nearExpiry = !rec.expiresAt || rec.expiresAt.getTime() - REFRESH_SKEW_MS < Date.now();
    if (nearExpiry) {
      const refreshed = await this.adapter.refreshTokens(tokens.refresh_token, shopId);
      if (refreshed.ok && refreshed.accessToken) {
        await this.persistTokens(tenantId, shopId, refreshed.accessToken, refreshed.refreshToken ?? tokens.refresh_token, refreshed.expireIn ?? 14400);
        tokens = { access_token: refreshed.accessToken, refresh_token: refreshed.refreshToken ?? tokens.refresh_token };
      } else {
        this.logger.warn(`Shopee refresh failed for tenant ${tenantId}: ${refreshed.error}`);
      }
    }
    return { accessToken: tokens.access_token, shopId };
  }

  async status(tenantId: string) {
    const rec = await this.record(tenantId);
    const cfg = (rec?.config as Record<string, unknown>) ?? {};
    return {
      configured: this.config.isConfigured,
      connected: rec?.status === 'connected',
      status: rec?.status ?? 'not_configured',
      shop_id: (cfg.shop_id as string) ?? null,
      expires_at: rec?.expiresAt ?? null,
      last_error: rec?.lastError ?? null,
    };
  }

  /** Connection test: fetch shop info with a valid token. */
  async test(tenantId: string) {
    const { accessToken, shopId } = await this.getValidToken(tenantId);
    const res = await this.adapter.getShopInfo(shopId, accessToken);
    if (!res.ok) {
      await this.markError(tenantId, `Test thất bại: ${res.error}`);
      throw new BadRequestException(`Shopee test thất bại: ${res.error}`);
    }
    await this.prisma.integration.updateMany({ where: { tenantId, provider: PROVIDER }, data: { status: 'connected', lastError: null } });
    return { ok: true, shop: res.data };
  }

  /** Read-only order sync over a recent window. Does not mutate anything on Shopee. */
  async syncOrders(tenantId: string, days = 7) {
    const { accessToken, shopId } = await this.getValidToken(tenantId);
    const safeDays = Math.min(Math.max(days, 1), 15); // Shopee caps the window at 15 days
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - safeDays * 24 * 3600;
    const list = await this.adapter.getOrderList(shopId, accessToken, { timeFrom, timeTo, pageSize: 50 });
    if (!list.ok) throw new BadRequestException(`Lấy danh sách đơn thất bại: ${list.error}`);

    const orderList: any[] = list.data?.response?.order_list ?? [];
    const snList = orderList.map((o) => o.order_sn).filter(Boolean);
    let details: any[] = [];
    if (snList.length) {
      const detail = await this.adapter.getOrderDetail(shopId, accessToken, snList);
      if (detail.ok) details = detail.data?.response?.order_list ?? [];
    }
    return {
      window_days: safeDays,
      count: orderList.length,
      more: !!list.data?.response?.more,
      orders: details.length ? details : orderList,
    };
  }
}
