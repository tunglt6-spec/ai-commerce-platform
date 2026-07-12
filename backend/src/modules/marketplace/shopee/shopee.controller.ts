import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
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
}
