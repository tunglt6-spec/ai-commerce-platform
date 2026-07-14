import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { assertSafeExternalUrl } from '../../../common/utils/url-safety';
import { ShopeeConfig } from './shopee.config';

export interface ShopeeTokenResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  expireIn?: number; // seconds
  error?: string;
}

export interface ShopeeApiResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  message?: string;
  data?: T;
}

const TIMEOUT_MS = 15_000;

/**
 * Stateless Shopee Open Platform API v2 client. Handles the v2 HMAC-SHA256 signing
 * (public vs shop-level base strings) and the concrete HTTP calls. No persistence
 * here — ShopeeService owns tokens. All methods fail-closed on missing config.
 */
@Injectable()
export class ShopeeAdapterService {
  private readonly logger = new Logger(ShopeeAdapterService.name);

  constructor(private readonly config: ShopeeConfig) {}

  private nowTs(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** v2 signature. Public (auth/token) base = partnerId+path+ts. Shop base adds accessToken+shopId. */
  sign(path: string, timestamp: number, accessToken?: string, shopId?: string | number): string {
    let base = `${this.config.partnerId}${path}${timestamp}`;
    if (accessToken && shopId !== undefined && shopId !== null && `${shopId}` !== '') {
      base += `${accessToken}${shopId}`;
    }
    return createHmac('sha256', this.config.partnerKey).update(base).digest('hex');
  }

  /** Build the signed common query string for a request. */
  private commonQuery(path: string, accessToken?: string, shopId?: string | number): string {
    const ts = this.nowTs();
    const sign = this.sign(path, ts, accessToken, shopId);
    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: String(ts),
      sign,
    });
    if (accessToken && shopId !== undefined && shopId !== null && `${shopId}` !== '') {
      params.set('access_token', accessToken);
      params.set('shop_id', String(shopId));
    }
    return params.toString();
  }

  /** URL the shop owner opens to authorize this app for their shop.
   *  `redirect` defaults to the configured callback; callers pass a state-carrying
   *  callback so the (JWT-less) OAuth return can be mapped back to a tenant. */
  buildAuthUrl(redirect?: string): string {
    const path = '/api/v2/shop/auth_partner';
    const ts = this.nowTs();
    const sign = this.sign(path, ts);
    const params = new URLSearchParams({
      partner_id: this.config.partnerId,
      timestamp: String(ts),
      sign,
      redirect: redirect || this.config.redirectUrl,
    });
    return `${this.config.host}${path}?${params.toString()}`;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: Record<string, unknown>; query?: Record<string, string | number>; accessToken?: string; shopId?: string | number } = {},
  ): Promise<ShopeeApiResult<T>> {
    if (!this.config.isConfigured) {
      return { ok: false, status: 0, error: 'SHOPEE_NOT_CONFIGURED' };
    }
    const qs = this.commonQuery(path, opts.accessToken, opts.shopId);
    const extra = opts.query
      ? '&' + new URLSearchParams(Object.entries(opts.query).map(([k, v]) => [k, String(v)])).toString()
      : '';
    const url = `${this.config.host}${path}?${qs}${extra}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(opts.body ?? {}) : undefined,
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as any;
      // Shopee returns HTTP 200 with an `error` string field on API errors.
      if (!res.ok || (json && json.error)) {
        return { ok: false, status: res.status, error: json?.error || `HTTP_${res.status}`, message: json?.message };
      }
      return { ok: true, status: res.status, data: json as T };
    } catch (e) {
      const err = e as Error;
      return { ok: false, status: 0, error: err.name === 'AbortError' ? 'TIMEOUT' : err.message };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Exchange the auth `code` (from the OAuth redirect) for shop tokens. */
  async getTokens(code: string, shopId: string | number): Promise<ShopeeTokenResult> {
    const res = await this.request<any>('POST', '/api/v2/auth/token/get', {
      body: { code, shop_id: Number(shopId), partner_id: Number(this.config.partnerId) },
    });
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expireIn: res.data.expire_in,
    };
  }

  /** Refresh an expired access token. */
  async refreshTokens(refreshToken: string, shopId: string | number): Promise<ShopeeTokenResult> {
    const res = await this.request<any>('POST', '/api/v2/auth/access_token/get', {
      body: { refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(this.config.partnerId) },
    });
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expireIn: res.data.expire_in,
    };
  }

  /** Validate a token by fetching shop info (used as the connection test). */
  async getShopInfo(shopId: string | number, accessToken: string): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/shop/get_shop_info', { accessToken, shopId });
  }

  /** List order serial numbers in a time window (read-only). */
  async getOrderList(
    shopId: string | number,
    accessToken: string,
    opts: { timeFrom: number; timeTo: number; pageSize?: number; cursor?: string; orderStatus?: string },
  ): Promise<ShopeeApiResult> {
    const query: Record<string, string | number> = {
      time_range_field: 'create_time',
      time_from: opts.timeFrom,
      time_to: opts.timeTo,
      page_size: opts.pageSize ?? 50,
    };
    if (opts.cursor) query.cursor = opts.cursor;
    if (opts.orderStatus) query.order_status = opts.orderStatus;
    return this.request('GET', '/api/v2/order/get_order_list', { accessToken, shopId, query });
  }

  /** Fetch full details for up to 50 order serial numbers (read-only). */
  async getOrderDetail(shopId: string | number, accessToken: string, orderSnList: string[]): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/order/get_order_detail', {
      accessToken,
      shopId,
      query: { order_sn_list: orderSnList.slice(0, 50).join(',') },
    });
  }

  // ---- Products (read) ----

  /** List item ids in the shop (read-only). */
  async getItemList(
    shopId: string | number,
    accessToken: string,
    opts: { offset?: number; pageSize?: number; itemStatus?: string } = {},
  ): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/product/get_item_list', {
      accessToken,
      shopId,
      query: { offset: opts.offset ?? 0, page_size: opts.pageSize ?? 50, item_status: opts.itemStatus ?? 'NORMAL' },
    });
  }

  /** Base info for up to 50 item ids (read-only). */
  async getItemBaseInfo(shopId: string | number, accessToken: string, itemIdList: number[]): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/product/get_item_base_info', {
      accessToken,
      shopId,
      query: { item_id_list: itemIdList.slice(0, 50).join(',') },
    });
  }

  // ---- Products (write) — only reached via the Execution Gateway ----

  /** Create a new listing. `item` is the Shopee add_item body. */
  async addItem(shopId: string | number, accessToken: string, item: Record<string, unknown>): Promise<ShopeeApiResult> {
    return this.request('POST', '/api/v2/product/add_item', { accessToken, shopId, body: item });
  }

  /** Update the price list for an existing item. */
  async updatePrice(shopId: string | number, accessToken: string, itemId: number, priceList: Array<Record<string, unknown>>): Promise<ShopeeApiResult> {
    return this.request('POST', '/api/v2/product/update_price', { accessToken, shopId, body: { item_id: itemId, price_list: priceList } });
  }

  /** Update the stock list for an existing item. */
  async updateStock(shopId: string | number, accessToken: string, itemId: number, stockList: Array<Record<string, unknown>>): Promise<ShopeeApiResult> {
    return this.request('POST', '/api/v2/product/update_stock', { accessToken, shopId, body: { item_id: itemId, stock_list: stockList } });
  }

  // ---- Listing helpers (for building a valid add_item) ----

  /** Enabled logistics channels for the shop (needed for logistic_info in add_item). */
  async getLogisticsChannels(shopId: string | number, accessToken: string): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/logistics/get_channel_list', { accessToken, shopId });
  }

  /** Shopee category tree (seller picks the leaf category_id). */
  async getCategory(shopId: string | number, accessToken: string, language = 'vi'): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/product/get_category', { accessToken, shopId, query: { language } });
  }

  /** Mandatory/optional attributes for a category (must be satisfied in add_item). */
  async getAttributes(shopId: string | number, accessToken: string, categoryId: number, language = 'vi'): Promise<ShopeeApiResult> {
    return this.request('GET', '/api/v2/product/get_attributes', { accessToken, shopId, query: { category_id: categoryId, language } });
  }

  /**
   * Upload an image to Shopee media space (multipart) and return its image_id, which
   * add_item requires. Fetches the image bytes from `imageUrl` first. v2 signature
   * is over the common params only (body is not signed for multipart).
   */
  async uploadImageFromUrl(shopId: string | number, accessToken: string, imageUrl: string): Promise<{ ok: boolean; imageId?: string; error?: string }> {
    if (!this.config.isConfigured) return { ok: false, error: 'SHOPEE_NOT_CONFIGURED' };
    // SSRF guard: imageUrl is caller-supplied and fetched server-side.
    try {
      await assertSafeExternalUrl(imageUrl);
    } catch (e) {
      return { ok: false, error: `SSRF_BLOCKED:${(e as Error).message}` };
    }
    const path = '/api/v2/media_space/upload_image';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // redirect:'error' — a validated public URL must not 302 into an internal target (SSRF);
      // dispatcher pins the validated IP at connect time (anti DNS-rebind TOCTOU).
      const imgRes = await fetch(imageUrl, { signal: controller.signal, redirect: 'error' });
      if (!imgRes.ok) return { ok: false, error: `IMAGE_FETCH_${imgRes.status}` };
      // Cap the download so a public-but-hostile URL can't exhaust memory.
      const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
      const declared = Number(imgRes.headers.get('content-length') || 0);
      if (declared > MAX_IMAGE_BYTES) return { ok: false, error: 'IMAGE_TOO_LARGE' };
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: 'IMAGE_TOO_LARGE' };
      const form = new FormData();
      form.append('image', new Blob([buf]), 'image.jpg');
      const url = `${this.config.host}${path}?${this.commonQuery(path, accessToken, shopId)}`;
      const res = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.error) return { ok: false, error: json?.error || `HTTP_${res.status}` };
      const imageId = json?.response?.image_info?.image_id ?? json?.response?.image_id;
      if (!imageId) return { ok: false, error: 'NO_IMAGE_ID' };
      return { ok: true, imageId };
    } catch (e) {
      const err = e as Error;
      return { ok: false, error: err.name === 'AbortError' ? 'TIMEOUT' : err.message };
    } finally {
      clearTimeout(timer);
    }
  }
}
