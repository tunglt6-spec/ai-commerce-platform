import { Controller, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.notificationsService.list(tenantId);
    return { success: true, data };
  }
}
