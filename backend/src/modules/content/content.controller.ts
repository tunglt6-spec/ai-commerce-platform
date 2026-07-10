import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import {
  ApproveContentDto,
  ContentQueryDto,
  CreateContentDto,
  ScheduleContentDto,
} from './dto/content.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('content')
  @Roles(ROLES.OPERATOR)
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateContentDto) {
    const data = await this.contentService.create(tenantId, dto);
    return { success: true, data };
  }

  @Get('content')
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ContentQueryDto) {
    const result = await this.contentService.findAll(tenantId, query);
    return { success: true, ...result };
  }

  @Patch('content/:id/submit')
  @Roles(ROLES.OPERATOR)
  async submit(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.contentService.submitForReview(tenantId, id);
    return { success: true, data };
  }

  @Patch('content/:id/approve')
  @Roles(ROLES.MANAGER)
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveContentDto,
  ) {
    const data = await this.contentService.approve(user.tenantId, id, user.userId, dto);
    return { success: true, data };
  }

  @Post('content/:id/schedule')
  @Roles(ROLES.MANAGER)
  async schedule(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ScheduleContentDto,
  ) {
    const data = await this.contentService.schedule(tenantId, id, dto);
    return { success: true, data };
  }

  @Get('content-calendar')
  async calendar(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.contentService.calendar(tenantId);
    return { success: true, data };
  }
}
