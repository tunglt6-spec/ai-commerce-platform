import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { IsString } from 'class-validator';

class UpdateRoleDto {
  @IsString()
  role!: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.usersService.me(user.userId, user.tenantId);
    return { success: true, data };
  }

  @Get()
  @Roles(ROLES.MANAGER)
  async list(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.usersService.listTenantMembers(tenantId);
    return { success: true, data };
  }

  @Patch(':userId/role')
  @Roles(ROLES.ADMIN)
  async updateRole(
    @CurrentUser('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const data = await this.usersService.updateMemberRole(tenantId, userId, dto.role);
    return { success: true, data };
  }
}
