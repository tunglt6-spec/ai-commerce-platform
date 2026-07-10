import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('workflows')
  definitions() {
    return { success: true, data: this.workflowService.definitions() };
  }

  @Post('workflows/:name/run')
  @Roles(ROLES.MANAGER)
  async run(@CurrentUser() user: AuthenticatedUser, @Param('name') name: string) {
    const data = await this.workflowService.run(user.tenantId, name, user.userId);
    return { success: true, data };
  }

  @Get('workflow-executions')
  async executions(@CurrentUser('tenantId') tenantId: string, @Query() query: PaginationDto) {
    const result = await this.workflowService.executions(tenantId, query);
    return { success: true, ...result };
  }

  @Get('workflow-executions/:id')
  async getExecution(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.workflowService.getExecution(tenantId, id);
    return { success: true, data };
  }
}
