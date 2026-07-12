import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
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
}
