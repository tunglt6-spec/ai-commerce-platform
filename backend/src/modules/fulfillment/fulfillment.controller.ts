import { Controller, Get, Param, Patch } from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller()
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Get('orders/:id/fulfillment-check')
  async check(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.fulfillmentService.check(tenantId, id);
    return { success: true, data };
  }

  @Patch('orders/:id/deliver')
  @Roles(ROLES.OPERATOR)
  async deliver(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.fulfillmentService.markDelivered(tenantId, id);
    return { success: true, data };
  }

  @Patch('orders/:id/complete')
  @Roles(ROLES.OPERATOR)
  async complete(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.fulfillmentService.markCompleted(tenantId, id);
    return { success: true, data };
  }

  @Get('fulfillment/exceptions')
  async exceptions(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.fulfillmentService.exceptions(tenantId);
    return { success: true, data };
  }
}
