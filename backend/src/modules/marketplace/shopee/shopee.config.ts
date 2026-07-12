import { Injectable } from '@nestjs/common';

/**
 * Shopee Open Platform credentials — platform-level, provided via environment on
 * the VPS (never committed, never returned by the API). Per-shop OAuth tokens are
 * stored encrypted per tenant (see ShopeeService), NOT here.
 *
 * Required env to go live:
 *   SHOPEE_PARTNER_ID   — Open Platform partner id (integer)
 *   SHOPEE_PARTNER_KEY  — Open Platform partner key (used for HMAC signing)
 *   SHOPEE_API_BASE     — https://partner.shopeemobile.com (live) | https://partner.test-stable.shopeemobile.com (sandbox)
 *   SHOPEE_REDIRECT_URL — public callback, e.g. https://store.picklefund.uk/api/v1/marketplace/shopee/callback
 */
@Injectable()
export class ShopeeConfig {
  get partnerId(): string {
    return process.env.SHOPEE_PARTNER_ID?.trim() ?? '';
  }
  get partnerKey(): string {
    return process.env.SHOPEE_PARTNER_KEY?.trim() ?? '';
  }
  get host(): string {
    return (process.env.SHOPEE_API_BASE?.trim() || 'https://partner.shopeemobile.com').replace(/\/$/, '');
  }
  get redirectUrl(): string {
    return (
      process.env.SHOPEE_REDIRECT_URL?.trim() ||
      'https://store.picklefund.uk/api/v1/marketplace/shopee/callback'
    );
  }
  /** True only when both partner id + key are present (adapter fails-safe otherwise). */
  get isConfigured(): boolean {
    return !!(this.partnerId && this.partnerKey);
  }
}
