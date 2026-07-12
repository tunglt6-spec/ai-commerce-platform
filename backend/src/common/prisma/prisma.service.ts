import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getTenantStore } from '../context/tenant-context';
import { shouldBlockQuery } from './tenant-guard';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    // Second tenant-isolation layer (defense-in-depth): fail-closed on a tenant-scoped
    // list/bulk query that lacks a tenant filter inside an authenticated request.
    // TENANT_GUARD_MODE: 'enforce' (default, fail-closed) or 'monitor' (log only — for a
    // safe production rollout: observe logs for false positives before enforcing).
    const monitorOnly = (process.env.TENANT_GUARD_MODE ?? 'enforce').toLowerCase() === 'monitor';
    this.$use(async (params, next) => {
      if (shouldBlockQuery(params.model, params.action, params.args, getTenantStore())) {
        const msg = `TENANT_GUARD ${params.model}.${params.action} without tenantId scope`;
        if (monitorOnly) {
          this.logger.warn(`[monitor] ${msg} (allowed — set TENANT_GUARD_MODE=enforce to block)`);
        } else {
          this.logger.error(`blocked ${msg}`);
          throw new Error(`TENANT_GUARD: ${params.model}.${params.action} requires a tenantId filter`);
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  /** Enable graceful shutdown so DB connections close cleanly. */
  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
