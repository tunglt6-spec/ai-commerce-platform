import { Module } from '@nestjs/common';
import { ShopeeController } from './shopee/shopee.controller';
import { ShopeeService } from './shopee/shopee.service';
import { ShopeeAdapterService } from './shopee/shopee-adapter.service';
import { ShopeeConfig } from './shopee/shopee.config';

/**
 * Marketplace integrations. Shopee Open Platform v2 adapter (real API v2 signing +
 * OAuth). Live use requires SHOPEE_PARTNER_ID/KEY env on the VPS and a shop OAuth
 * grant; without config the adapter fails-safe (no fake success).
 */
@Module({
  controllers: [ShopeeController],
  providers: [ShopeeConfig, ShopeeAdapterService, ShopeeService],
  exports: [ShopeeService, ShopeeAdapterService],
})
export class MarketplaceModule {}
