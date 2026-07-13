import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { assertSafeExternalUrl, ssrfSafeDispatcher } from '../../common/utils/url-safety';
import { ConnectIntegrationDto } from './dto/integration.dto';

export const PROVIDERS = [
  { key: 'website', label: 'Website', kind: 'channel' },
  { key: 'facebook', label: 'Facebook', kind: 'channel' },
  { key: 'instagram', label: 'Instagram', kind: 'channel' },
  { key: 'tiktok', label: 'TikTok', kind: 'channel' },
  { key: 'zalo', label: 'Zalo', kind: 'channel' },
  { key: 'youtube', label: 'YouTube', kind: 'channel' },
  { key: 'shopee', label: 'Shopee', kind: 'marketplace' },
  { key: 'lazada', label: 'Lazada', kind: 'marketplace' },
  { key: 'tiki', label: 'Tiki', kind: 'marketplace' },
  { key: 'email', label: 'Email', kind: 'messaging' },
  { key: 'sms', label: 'SMS', kind: 'messaging' },
  { key: 'chatbot', label: 'Chatbot', kind: 'messaging' },
  { key: 'payment', label: 'Payment Gateway', kind: 'payment' },
  { key: 'shipping', label: 'Shipping Carrier', kind: 'shipping' },
] as const;

const PROVIDER_KEYS = new Set(PROVIDERS.map((p) => p.key));

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async list(tenantId: string) {
    const records = await this.prisma.integration.findMany({ where: { tenantId } });
    const byProvider = new Map(records.map((r) => [r.provider, r]));
    return PROVIDERS.map((p) => {
      const r = byProvider.get(p.key);
      const cfg = (r?.config as Record<string, unknown>) ?? {};
      return {
        provider: p.key,
        label: p.label,
        kind: p.kind,
        status: r?.status ?? 'not_configured',
        connected_at: r?.connectedAt ?? null,
        expires_at: r?.expiresAt ?? null,
        last_error: r?.lastError ?? null,
        has_credentials: !!r?.secretRef,
        // Non-secret config is safe to return.
        verify_url: (cfg.verify_url as string) ?? null,
        webhook_url: (cfg.webhook_url as string) ?? null,
      };
    });
  }

  async connect(tenantId: string, provider: string, dto: ConnectIntegrationDto) {
    if (!PROVIDER_KEYS.has(provider as any)) throw new BadRequestException('Unknown provider');
    if (!dto.api_key && !dto.access_token) {
      await this.upsert(tenantId, provider, {
        status: 'error',
        lastError: 'Missing credentials (api_key or access_token required)',
      });
      throw new BadRequestException('Missing credentials: provide api_key or access_token');
    }

    const secret = dto.api_key ?? dto.access_token ?? '';
    const secretRef = this.encryption.encrypt(secret); // reversible, server-side only
    const expiresAt = dto.expires_in ? new Date(Date.now() + dto.expires_in * 1000) : null;

    await this.upsert(tenantId, provider, {
      // "connected" only becomes authoritative after a successful test; start as connecting.
      status: 'connecting',
      config: (dto.config ?? {}) as any,
      secretRef,
      lastError: null,
      connectedAt: new Date(),
      expiresAt,
    });

    // If a verify_url is configured, run a real connection test immediately.
    if (dto.config?.verify_url) {
      return this.test(tenantId, provider);
    }
    // No verify endpoint: mark connected (credentials stored) — cannot verify further.
    const updated = await this.upsert(tenantId, provider, { status: 'connected' });
    return this.sanitize(updated);
  }

  async disconnect(tenantId: string, provider: string) {
    if (!PROVIDER_KEYS.has(provider as any)) throw new BadRequestException('Unknown provider');
    const record = await this.upsert(tenantId, provider, {
      status: 'disabled',
      secretRef: null,
      connectedAt: null,
      expiresAt: null,
    });
    return this.sanitize(record);
  }

  /** Real connection test: performs an actual HTTP request to config.verify_url. */
  async test(tenantId: string, provider: string) {
    const record = await this.prisma.integration.findFirst({ where: { tenantId, provider } });
    if (!record) throw new NotFoundException('Integration not configured');
    const cfg = (record.config as Record<string, unknown>) ?? {};
    const verifyUrl = cfg.verify_url as string | undefined;
    if (!verifyUrl) throw new BadRequestException('No verify_url configured for this integration');
    if (!record.secretRef) throw new BadRequestException('No credentials stored');

    // SSRF guard: verify_url is tenant-supplied and fetched server-side.
    try {
      await assertSafeExternalUrl(verifyUrl);
    } catch (e) {
      const updated = await this.upsert(tenantId, provider, { status: 'error', lastError: `Verify blocked: ${(e as Error).message}` });
      return this.sanitize(updated);
    }

    const secret = this.encryption.decrypt(record.secretRef);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(verifyUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error', // don't follow redirects into an internal target (SSRF)
        dispatcher: ssrfSafeDispatcher, // pin the validated IP at connect (anti DNS-rebind)
      } as any);
      if (res.ok) {
        const updated = await this.upsert(tenantId, provider, {
          status: 'connected',
          lastError: null,
          connectedAt: new Date(),
        });
        return this.sanitize(updated);
      }
      const updated = await this.upsert(tenantId, provider, {
        status: 'error',
        lastError: `Verify failed: HTTP ${res.status}`,
      });
      return this.sanitize(updated);
    } catch (e) {
      const message = (e as Error).name === 'AbortError' ? 'Verify timeout' : `Verify error: ${(e as Error).message}`;
      const updated = await this.upsert(tenantId, provider, { status: 'error', lastError: message });
      return this.sanitize(updated);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Dispatch an event to all connected integrations that have a webhook_url.
   * Signs the payload with HMAC-SHA256 using the (decrypted) secret. Fire-and-forget;
   * failures are recorded on the integration, never thrown to the caller.
   */
  async dispatchEvent(tenantId: string, event: string, payload: Record<string, unknown>) {
    const targets = await this.prisma.integration.findMany({
      where: { tenantId, status: 'connected', secretRef: { not: null } },
    });
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

    await Promise.all(
      targets.map(async (t) => {
        const cfg = (t.config as Record<string, unknown>) ?? {};
        const url = cfg.webhook_url as string | undefined;
        if (!url || !t.secretRef) return;
        try {
          // SSRF guard: webhook_url is tenant-supplied and POSTed to server-side.
          await assertSafeExternalUrl(url).catch((e) => {
            throw new Error(`blocked ${(e as Error).message}`);
          });
          const secret = this.encryption.decrypt(t.secretRef);
          const signature = createHmac('sha256', secret).update(body).digest('hex');
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Commerce-Event': event,
              'X-Commerce-Signature': `sha256=${signature}`,
            },
            body,
            signal: controller.signal,
            redirect: 'error', // don't follow redirects into an internal target (SSRF)
            dispatcher: ssrfSafeDispatcher, // pin the validated IP at connect (anti DNS-rebind)
          } as any).finally(() => clearTimeout(timeout));
          if (!res.ok) {
            await this.upsert(tenantId, t.provider, { lastError: `Webhook ${event}: HTTP ${res.status}` });
          }
        } catch (e) {
          this.logger.warn(`Webhook dispatch to ${t.provider} failed: ${(e as Error).message}`);
          await this.upsert(tenantId, t.provider, { lastError: `Webhook ${event}: ${(e as Error).message}` });
        }
      }),
    );
  }

  private async upsert(tenantId: string, provider: string, data: Record<string, unknown>) {
    return this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      update: data as any,
      create: { tenantId, provider, ...(data as any) },
    });
  }

  private sanitize(record: any) {
    return {
      provider: record.provider,
      status: record.status,
      connected_at: record.connectedAt,
      expires_at: record.expiresAt,
      last_error: record.lastError,
      has_credentials: !!record.secretRef,
    };
  }
}
