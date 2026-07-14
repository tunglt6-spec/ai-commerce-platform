import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { isIP } from 'net';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { isPrivateAddress } from '../../../common/utils/url-safety';
import { ConnectEmailDto, SendEmailDto } from './dto/email.dto';

const PROVIDER = 'email';

interface StoredEmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  from_email: string;
  from_name?: string;
}

/**
 * Email (SMTP) integration. Stores per-tenant SMTP credentials (password encrypted at
 * rest via EncryptionService) in the Integration table under provider 'email', and sends
 * mail with nodemailer. Fail-closed: throws if the tenant hasn't configured SMTP.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /** Reject obviously-internal SMTP hosts (admin-supplied, connected to server-side). */
  private assertSafeHost(host: string): void {
    const h = host.trim().toLowerCase();
    if (!h) throw new BadRequestException('Thiếu SMTP host');
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) {
      throw new BadRequestException('SMTP host không hợp lệ (nội bộ/loopback).');
    }
    if (isIP(h) && isPrivateAddress(h)) {
      throw new BadRequestException('SMTP host không hợp lệ (địa chỉ nội bộ/private).');
    }
  }

  async connect(tenantId: string, dto: ConnectEmailDto) {
    this.assertSafeHost(dto.smtp_host);
    const port = Number(dto.smtp_port ?? 465);
    const config: StoredEmailConfig = {
      smtp_host: dto.smtp_host.trim(),
      smtp_port: port,
      smtp_secure: dto.smtp_secure ?? port === 465, // 465 = implicit TLS; 587 = STARTTLS
      smtp_user: dto.smtp_user.trim(),
      from_email: dto.from_email.trim(),
      from_name: dto.from_name?.trim() || undefined,
    };
    const secretRef = this.encryption.encrypt(dto.smtp_password);
    await this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId, provider: PROVIDER } },
      create: { tenantId, provider: PROVIDER, status: 'connecting', config: config as any, secretRef, connectedAt: new Date(), isActive: true },
      update: { status: 'connecting', config: config as any, secretRef, lastError: null, connectedAt: new Date(), isActive: true },
    });
    return this.status(tenantId);
  }

  async status(tenantId: string) {
    const rec = await this.prisma.integration.findFirst({ where: { tenantId, provider: PROVIDER } });
    const cfg = (rec?.config as Partial<StoredEmailConfig>) ?? {};
    return {
      configured: !!rec?.secretRef,
      connected: rec?.status === 'connected',
      status: rec?.status ?? 'not_configured',
      smtp_host: cfg.smtp_host ?? null,
      smtp_port: cfg.smtp_port ?? null,
      from_email: cfg.from_email ?? null,
      from_name: cfg.from_name ?? null,
      last_error: rec?.lastError ?? null,
    };
  }

  async disconnect(tenantId: string) {
    await this.prisma.integration.updateMany({
      where: { tenantId, provider: PROVIDER },
      data: { status: 'disabled', secretRef: null, connectedAt: null },
    });
    return this.status(tenantId);
  }

  private async transportFor(tenantId: string): Promise<{ transporter: nodemailer.Transporter; cfg: StoredEmailConfig }> {
    const rec = await this.prisma.integration.findFirst({ where: { tenantId, provider: PROVIDER } });
    if (!rec || !rec.secretRef) throw new BadRequestException('Chưa cấu hình Email — hãy kết nối SMTP trước.');
    const cfg = rec.config as unknown as StoredEmailConfig;
    if (!cfg?.smtp_host || !cfg?.smtp_user || !cfg?.from_email) throw new BadRequestException('Cấu hình SMTP không đầy đủ.');
    this.assertSafeHost(cfg.smtp_host);
    const password = this.encryption.decrypt(rec.secretRef);
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port,
      secure: !!cfg.smtp_secure,
      auth: { user: cfg.smtp_user, pass: password },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
    });
    return { transporter, cfg };
  }

  /** Send an email using the tenant's configured SMTP. Fail-closed if not configured. */
  async send(tenantId: string, msg: SendEmailDto): Promise<{ ok: boolean; messageId?: string }> {
    if (!msg.text && !msg.html) throw new BadRequestException('Cần text hoặc html cho nội dung email.');
    const { transporter, cfg } = await this.transportFor(tenantId);
    const from = cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email;
    const info = await transporter.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    return { ok: true, messageId: info.messageId };
  }

  /** Connection test: sends a real test email and flips the integration to connected/error. */
  async test(tenantId: string, to?: string) {
    const st = await this.status(tenantId);
    const recipient = to || st.from_email;
    if (!recipient) throw new BadRequestException('Không có địa chỉ nhận (nhập "to" hoặc cấu hình from_email).');
    try {
      const info = await this.send(tenantId, {
        to: recipient,
        subject: '[AI Commerce] Email tích hợp hoạt động ✓',
        text: `Tích hợp Email (SMTP) của cửa hàng đã hoạt động.\nThời điểm: ${new Date().toISOString()}`,
      });
      await this.prisma.integration.updateMany({ where: { tenantId, provider: PROVIDER }, data: { status: 'connected', lastError: null } });
      return { ok: true, messageId: info.messageId, sent_to: recipient };
    } catch (e) {
      const message = (e as Error).message;
      await this.prisma.integration
        .updateMany({ where: { tenantId, provider: PROVIDER }, data: { status: 'error', lastError: `Test thất bại: ${message}` } })
        .catch(() => null);
      throw new BadRequestException(`Gửi email test thất bại: ${message}`);
    }
  }
}
