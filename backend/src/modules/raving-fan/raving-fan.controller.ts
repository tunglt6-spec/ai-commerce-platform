import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RavingFanService } from './raving-fan.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller('ai/raving-fan')
export class RavingFanController {
  constructor(private readonly ravingFanService: RavingFanService) {}

  @Post('follow-up/:orderId')
  @Roles(ROLES.OPERATOR)
  async followUp(@CurrentUser('tenantId') tenantId: string, @Param('orderId') orderId: string) {
    const data = await this.ravingFanService.followUp(tenantId, orderId);
    return { success: true, data };
  }

  @Get('win-back')
  async winBack(@CurrentUser('tenantId') tenantId: string, @Query('days') days?: string) {
    const data = await this.ravingFanService.winBack(tenantId, Math.min(parseInt(days ?? '30', 10) || 30, 365));
    return { success: true, data };
  }

  @Get('upsell/:customerId')
  async upsell(@CurrentUser('tenantId') tenantId: string, @Param('customerId') customerId: string) {
    const data = await this.ravingFanService.upsell(tenantId, customerId);
    return { success: true, data };
  }

  @Post('recompute-segments')
  @Roles(ROLES.MANAGER)
  async recompute(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.ravingFanService.recomputeSegments(tenantId);
    return { success: true, data };
  }
}
