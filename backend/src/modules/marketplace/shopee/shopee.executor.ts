import { Injectable, OnModuleInit } from '@nestjs/common';
import { ActionExecutorRegistry } from '../../compliance/services/action-executor.registry';
import { ACTION } from '../../compliance/compliance.constants';
import { ShopeeService } from './shopee.service';

/**
 * Wires the Shopee "push product" side-effect into the Execution Gateway via the
 * neutral ActionExecutorRegistry — so the gateway executes it (only after a
 * compliance decision + approval) without compliance importing marketplace.
 */
@Injectable()
export class ShopeeExecutor implements OnModuleInit {
  constructor(
    private readonly registry: ActionExecutorRegistry,
    private readonly shopee: ShopeeService,
  ) {}

  onModuleInit(): void {
    this.registry.register(ACTION.PUSH_PRODUCT, async (ctx) => {
      if (ctx.platform !== 'shopee') {
        return { ok: false, error: 'UNSUPPORTED_PLATFORM', responseRedacted: { platform: ctx.platform } };
      }
      return this.shopee.pushProduct(ctx.tenantId, ctx.payload);
    });

    this.registry.register(ACTION.CREATE_LISTING, async (ctx) => {
      if (ctx.platform !== 'shopee') {
        return { ok: false, error: 'UNSUPPORTED_PLATFORM', responseRedacted: { platform: ctx.platform } };
      }
      return this.shopee.createListing(ctx.tenantId, ctx.payload);
    });
  }
}
