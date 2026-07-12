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

  // ---- Products ----

  private async getImportCategoryId(tenantId: string): Promise<string> {
    const cat = await this.prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: 'shopee-import' } },
      create: { tenantId, name: 'Shopee Import', slug: 'shopee-import' },
      update: {},
      select: { id: true },
    });
    return cat.id;
  }

  /** Import (read-only from Shopee): pull items and upsert them into internal Products. */
  async importProducts(tenantId: string) {
    const { accessToken, shopId } = await this.getValidToken(tenantId);
    const list = await this.adapter.getItemList(shopId, accessToken, { pageSize: 50 });
    if (!list.ok) throw new BadRequestException(`Lấy danh sách sản phẩm thất bại: ${list.error}`);
    const itemIds: number[] = (list.data?.response?.item ?? []).map((i: any) => i.item_id).filter(Boolean);
    if (!itemIds.length) return { imported: 0, updated: 0, items: [] };

    const info = await this.adapter.getItemBaseInfo(shopId, accessToken, itemIds);
    if (!info.ok) throw new BadRequestException(`Lấy thông tin sản phẩm thất bại: ${info.error}`);
    const items: any[] = info.data?.response?.item_list ?? [];
    const categoryId = await this.getImportCategoryId(tenantId);

    let imported = 0;
    let updated = 0;
    const result: any[] = [];
    for (const it of items) {
      const sku = String(it.item_sku || `SHOPEE-${it.item_id}`);
      const price = Number(it.price_info?.[0]?.current_price ?? it.price_info?.[0]?.original_price ?? 0);
      const stock = Number(it.stock_info_v2?.summary_info?.total_available_stock ?? it.stock_info?.[0]?.current_stock ?? 0);
      const existing = await this.prisma.product.findFirst({ where: { tenantId, sku } });
      const data = {
        name: String(it.item_name ?? sku).slice(0, 250),
        retailPrice: price || 0,
        shortDescription: `Nhập từ Shopee · item_id ${it.item_id}`,
        tags: ['shopee', `shopee_item:${it.item_id}`],
      };
      if (existing) {
        await this.prisma.product.update({ where: { id: existing.id }, data: { ...data, retailPrice: price || existing.retailPrice } });
        updated += 1;
      } else {
        await this.prisma.product.create({
          data: { tenantId, sku, categoryId, costPrice: 0, status: 'active', ...data },
        });
        imported += 1;
      }
      result.push({ item_id: it.item_id, sku, name: data.name, price, stock });
    }
    return { imported, updated, count: items.length, items: result };
  }

  /**
   * Push a product to Shopee — ONLY invoked by the Execution Gateway executor after
   * a compliance decision + (usually) human approval. MVP: update price/stock of an
   * existing listing (payload.shopee_item_id required). Creating a brand-new listing
   * (add_item) needs full media/logistics/category and is a later phase.
   */
  async pushProduct(tenantId: string, payload: Record<string, any>): Promise<{ ok: boolean; externalReference?: string; responseRedacted?: Record<string, unknown>; error?: string }> {
    let token: { accessToken: string; shopId: string };
    try {
      token = await this.getValidToken(tenantId);
    } catch (e) {
      return { ok: false, error: (e as Error).message, responseRedacted: { stage: 'auth', error: (e as Error).message } };
    }
    const itemId = Number(payload.shopee_item_id);
    if (!itemId) {
      return { ok: false, error: 'MISSING_SHOPEE_ITEM_ID', responseRedacted: { note: 'Tạo listing mới (add_item) chưa hỗ trợ; cần shopee_item_id của sản phẩm đã có trên Shopee.' } };
    }
    const results: Record<string, unknown> = {};
    if (payload.price != null) {
      const r = await this.adapter.updatePrice(token.shopId, token.accessToken, itemId, [{ original_price: Number(payload.price) }]);
      results.price = r.ok ? 'updated' : `failed:${r.error}`;
      if (!r.ok) return { ok: false, error: r.error, responseRedacted: results };
    }
    if (payload.stock != null) {
      const r = await this.adapter.updateStock(token.shopId, token.accessToken, itemId, [{ seller_stock: [{ stock: Number(payload.stock) }] }]);
      results.stock = r.ok ? 'updated' : `failed:${r.error}`;
      if (!r.ok) return { ok: false, error: r.error, responseRedacted: results };
    }
    return { ok: true, externalReference: `shopee_item_${itemId}`, responseRedacted: { item_id: itemId, ...results } };
  }
}
