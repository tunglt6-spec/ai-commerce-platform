import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ROLES } from '../../../common/constants/roles';
import { ShopeeService } from './shopee.service';

@Controller('marketplace/shopee')
export class ShopeeController {
  constructor(private readonly shopee: ShopeeService) {}

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
}
