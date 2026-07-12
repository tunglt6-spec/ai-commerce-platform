import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ROLES } from '../../../common/constants/roles';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { ComplianceService } from '../../compliance/services/compliance.service';
import { ShopeeService } from './shopee.service';

export class PushProductDto {
  @IsOptional() @IsString() shopee_item_id?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() stock?: number;
}

export class CreateListingDto {
  @IsNumber() category_id!: number;
  @IsNumber() price!: number;
  @IsNumber() stock!: number;
  @IsNumber() weight_kg!: number;
  @IsArray() logistics!: Array<{ logistic_id: number; enabled: boolean; is_free?: boolean; shipping_fee?: number }>;
  @IsOptional() @IsArray() image_urls?: string[];
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() dimension_cm?: { length: number; width: number; height: number };
  @IsOptional() @IsArray() attribute_list?: Array<Record<string, unknown>>;
  @IsOptional() @IsObject() brand?: { brand_id: number; original_brand_name?: string };
  @IsOptional() @IsIn(['NEW', 'USED']) condition?: 'NEW' | 'USED';
  @IsOptional() @IsNumber() days_to_ship?: number;
}

@Controller('marketplace/shopee')
export class ShopeeController {
  constructor(
    private readonly shopee: ShopeeService,
    private readonly compliance: ComplianceService,
  ) {}

  @Get('status')
  async status(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: await this.shopee.status(tenantId) };
  }

  /** Returns the Shopee authorize URL the admin opens to grant shop access. */
  @Get('auth-url')
  @Roles(ROLES.MANAGER)
  authUrl(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: this.shopee.getAuthUrl(tenantId) };
  }

  /** OAuth return from Shopee (no JWT here — tenant is carried in the signed :state). */
  @Public()
  @Get('callback/:state')
  async callback(
    @Param('state') state: string,
    @Query('code') code: string,
    @Query('shop_id') shopId: string,
    @Res() res: Response,
  ) {
    const target = await this.shopee.handleCallback(state, code, shopId);
    res.redirect(302, target);
  }

  @Post('test')
  @Roles(ROLES.MANAGER)
  async test(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: await this.shopee.test(tenantId) };
  }

  /** Read-only order sync over a recent window (default 7 days, max 15). */
  @Get('orders')
  @Roles(ROLES.OPERATOR)
  async orders(@CurrentUser('tenantId') tenantId: string, @Query('days') days?: string) {
    return { success: true, data: await this.shopee.syncOrders(tenantId, Number(days) || 7) };
  }

  /** Import (read-only): pull Shopee items into internal Products. */
  @Post('products/import')
  @Roles(ROLES.OPERATOR)
  async importProducts(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: await this.shopee.importProducts(tenantId) };
  }

  /**
   * Push a product to Shopee. This is an EXTERNAL WRITE — it never calls Shopee
   * directly; it creates a compliance proposal that must clear the Policy Guard +
   * (usually) human approval, then be executed via the Execution Gateway.
   */
  @Post('products/:productId/push')
  @Roles(ROLES.OPERATOR)
  async pushProduct(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string, @Body() dto: PushProductDto) {
    const data = await this.compliance.propose(
      user.tenantId,
      { userId: user.userId },
      {
        agentId: 'product_ai',
        actionType: 'push_product',
        platform: 'shopee',
        targetType: 'product',
        targetId: productId,
        payload: {
          product_id: productId,
          shopee_item_id: dto.shopee_item_id,
          price: dto.price,
          stock: dto.stock,
          financial_impact: dto.price ?? 0,
        },
      },
    );
    return { success: true, data };
  }

  /**
   * Read-only reference data for building a new listing: enabled logistics channels,
   * the Shopee category tree, and (with ?category_id) that category's attributes.
   */
  @Get('listing-refs')
  @Roles(ROLES.OPERATOR)
  async listingRefs(@CurrentUser('tenantId') tenantId: string, @Query('category_id') categoryId?: string) {
    return { success: true, data: await this.shopee.listingRefs(tenantId, categoryId ? Number(categoryId) : undefined) };
  }

  /**
   * Create a brand-new Shopee listing (add_item) from an internal product. EXTERNAL
   * WRITE — never calls Shopee directly; raises a compliance proposal that must clear
   * the Policy Guard + human approval, then runs via the Execution Gateway executor.
   */
  @Post('products/:productId/create-listing')
  @Roles(ROLES.OPERATOR)
  async createListing(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string, @Body() dto: CreateListingDto) {
    const data = await this.compliance.propose(
      user.tenantId,
      { userId: user.userId },
      {
        agentId: 'product_ai',
        actionType: 'create_listing',
        platform: 'shopee',
        targetType: 'product',
        targetId: productId,
        payload: {
          product_id: productId,
          category_id: dto.category_id,
          price: dto.price,
          stock: dto.stock,
          weight_kg: dto.weight_kg,
          logistics: dto.logistics,
          image_urls: dto.image_urls,
          name: dto.name,
          description: dto.description,
          dimension_cm: dto.dimension_cm,
          attribute_list: dto.attribute_list,
          brand: dto.brand,
          condition: dto.condition,
          days_to_ship: dto.days_to_ship,
          financial_impact: dto.price ?? 0,
        },
      },
    );
    return { success: true, data };
  }
}
