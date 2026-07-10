import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto, ReturnQueryDto, UpdateReturnDto } from './dto/return.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller()
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post('orders/:orderId/returns')
  @Roles(ROLES.OPERATOR)
  async request(
    @CurrentUser('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreateReturnDto,
  ) {
    const data = await this.returnsService.request(tenantId, orderId, dto);
    return { success: true, data };
  }

  @Get('returns')
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ReturnQueryDto) {
    const result = await this.returnsService.findAll(tenantId, query);
    return { success: true, ...result };
  }

  @Patch('returns/:id')
  @Roles(ROLES.MANAGER)
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReturnDto,
  ) {
    const data = await this.returnsService.updateStatus(tenantId, id, dto);
    return { success: true, data };
  }
}
