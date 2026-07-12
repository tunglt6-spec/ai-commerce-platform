import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { ShopeeController } from './shopee/shopee.controller';
import { ShopeeService } from './shopee/shopee.service';
import { ShopeeAdapterService } from './shopee/shopee-adapter.service';
import { ShopeeConfig } from './shopee/shopee.config';
import { ShopeeExecutor } from './shopee/shopee.executor';

/**
 * Marketplace integrations. Shopee Open Platform v2 adapter (real API v2 signing +
 * OAuth). Product "push" is an external write routed through the Compliance module's
 * Execution Gateway (via ActionExecutorRegistry) — never called directly.
 * Live use requires SHOPEE_PARTNER_ID/KEY env on the VPS and a shop OAuth grant.
 */
@Module({
  imports: [ComplianceModule],
  controllers: [ShopeeController],
  providers: [ShopeeConfig, ShopeeAdapterService, ShopeeService, ShopeeExecutor],
  exports: [ShopeeService, ShopeeAdapterService],
})
export class MarketplaceModule {}
