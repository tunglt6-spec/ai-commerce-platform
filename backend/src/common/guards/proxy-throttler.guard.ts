import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit key derivation for a deployment behind Cloudflare → nginx.
 * The default ThrottlerGuard keys on the socket peer, which is the proxy — so every
 * client would share one bucket and the per-IP auth limits would collapse into a single
 * global limit. We prefer Cloudflare's authenticated client header, then the left-most
 * X-Forwarded-For hop, then the socket IP.
 *
 * NOTE: this is a defense-in-depth availability control, not an authorization control.
 * `CF-Connecting-IP` / `X-Forwarded-For` are only trustworthy because the origin is
 * reachable only via Cloudflare + nginx (see deploy/nginx-commerce.conf). If the origin
 * were directly reachable these headers could be spoofed — keep origin ingress locked down.
 */
@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Trust ONLY Cloudflare's authenticated client header (origin is locked to CF ingress —
    // see AICP-H21). Do NOT parse X-Forwarded-For directly: its left-most entry is
    // client-controlled, so rotating it would reset the throttle bucket every request and
    // defeat brute-force protection. Fallback is req.ip (bounded via Express trust-proxy).
    const cf = req.headers?.['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
