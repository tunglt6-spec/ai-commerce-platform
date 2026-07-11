import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/tenant.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('me')
  async me(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.tenant.getProfile(tenantId);
    return { success: true, data };
  }

  @Patch('me')
  @Roles(ROLES.MANAGER)
  async update(@CurrentUser('tenantId') tenantId: string, @Body() dto: UpdateTenantDto) {
    const data = await this.tenant.updateProfile(tenantId, dto);
    return { success: true, data };
  }
}
