import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { ConnectIntegrationDto } from './dto/integration.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  async list(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.integrationsService.list(tenantId);
    return { success: true, data };
  }

  @Post(':provider/connect')
  @Roles(ROLES.ADMIN)
  async connect(
    @CurrentUser('tenantId') tenantId: string,
    @Param('provider') provider: string,
    @Body() dto: ConnectIntegrationDto,
  ) {
    const data = await this.integrationsService.connect(tenantId, provider, dto);
    return { success: true, data };
  }

  @Post(':provider/disconnect')
  @Roles(ROLES.ADMIN)
  async disconnect(@CurrentUser('tenantId') tenantId: string, @Param('provider') provider: string) {
    const data = await this.integrationsService.disconnect(tenantId, provider);
    return { success: true, data };
  }
}
