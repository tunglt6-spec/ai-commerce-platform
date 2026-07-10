import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Reversible secret encryption for integration credentials (AES-256-GCM).
 * Ciphertext format: v1:<ivB64>.<tagB64>.<ctB64>. The key comes from
 * INTEGRATION_ENC_KEY (32-byte base64/hex) or is derived from JWT_ACCESS_SECRET
 * for local dev. Plaintext secrets are never returned by the API or logged.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('integrationEncKey') || '';
    if (raw) {
      const buf = raw.length === 64 ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
      this.key = buf.length === 32 ? buf : scryptSync(raw, 'ai-commerce-int', 32);
    } else {
      // Dev fallback: derive from the access secret. Set INTEGRATION_ENC_KEY in prod.
      const secret = config.get<string>('jwt.accessSecret') as string;
      this.key = scryptSync(secret, 'ai-commerce-int', 32);
      this.logger.warn('INTEGRATION_ENC_KEY not set — deriving key from JWT secret (dev only).');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  }

  decrypt(blob: string): string {
    if (!blob?.startsWith('v1:')) throw new Error('Invalid ciphertext');
    const [ivB64, tagB64, ctB64] = blob.slice(3).split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }
}
