import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConnectIntegrationDto } from './dto/integration.dto';

/** Supported providers (adapter registry). */
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
  constructor(private readonly prisma: PrismaService) {}

  /** List all providers with their current connection status (never exposes secrets). */
  async list(tenantId: string) {
    const records = await this.prisma.integration.findMany({ where: { tenantId } });
    const byProvider = new Map(records.map((r) => [r.provider, r]));
    return PROVIDERS.map((p) => {
      const r = byProvider.get(p.key);
      return {
        provider: p.key,
        label: p.label,
        kind: p.kind,
        status: r?.status ?? 'not_configured',
        connected_at: r?.connectedAt ?? null,
        expires_at: r?.expiresAt ?? null,
        last_error: r?.lastError ?? null,
        has_credentials: !!r?.secretRef,
      };
    });
  }

  /**
   * Connect a provider. Validates that credentials are supplied, stores only a
   * NON-reversible reference to the secret (never plaintext, never returned).
   * Does not fake "connected" without credentials.
   */
  async connect(tenantId: string, provider: string, dto: ConnectIntegrationDto) {
    if (!PROVIDER_KEYS.has(provider as any)) {
      throw new BadRequestException('Unknown provider');
    }
    if (!dto.api_key && !dto.access_token) {
      // No credentials → record an error state, do not mark connected.
      await this.upsert(tenantId, provider, {
        status: 'error',
        lastError: 'Missing credentials (api_key or access_token required)',
      });
      throw new BadRequestException('Missing credentials: provide api_key or access_token');
    }

    const secret = dto.api_key ?? dto.access_token ?? '';
    // Store a masked, non-reversible reference only. Real deployments must use a
    // secret vault; the raw secret is intentionally NOT persisted or logged.
    const secretRef = `sha256:${createHash('sha256').update(secret).digest('hex').slice(0, 12)}`;
    const expiresAt = dto.expires_in ? new Date(Date.now() + dto.expires_in * 1000) : null;

    const record = await this.upsert(tenantId, provider, {
      status: 'connected',
      config: (dto.config ?? {}) as any,
      secretRef,
      lastError: null,
      connectedAt: new Date(),
      expiresAt,
    });
    return this.sanitize(record);
  }

  async disconnect(tenantId: string, provider: string) {
    if (!PROVIDER_KEYS.has(provider as any)) {
      throw new BadRequestException('Unknown provider');
    }
    const record = await this.upsert(tenantId, provider, {
      status: 'disabled',
      secretRef: null,
      connectedAt: null,
      expiresAt: null,
    });
    return this.sanitize(record);
  }

  private async upsert(tenantId: string, provider: string, data: Record<string, unknown>) {
    return this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      update: data as any,
      create: { tenantId, provider, ...(data as any) },
    });
  }

  /** Strip secretRef/config before returning to clients. */
  private sanitize(record: any) {
    return {
      provider: record.provider,
      status: record.status,
      connected_at: record.connectedAt,
      expires_at: record.expiresAt,
      has_credentials: !!record.secretRef,
    };
  }
}
