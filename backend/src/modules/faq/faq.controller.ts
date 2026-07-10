import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FaqService } from './faq.service';
import { SalesService } from './sales.service';
import { CreateFaqDto, SalesRespondDto, UpdateFaqDto } from './dto/faq.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller()
export class FaqController {
  constructor(
    private readonly faqService: FaqService,
    private readonly salesService: SalesService,
  ) {}

  @Post('faq')
  @Roles(ROLES.OPERATOR)
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFaqDto) {
    const data = await this.faqService.create(tenantId, dto);
    return { success: true, data };
  }

  @Get('faq')
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query('category') category?: string) {
    const data = await this.faqService.findAll(tenantId, category);
    return { success: true, data };
  }

  @Get('faq/search')
  async search(@CurrentUser('tenantId') tenantId: string, @Query('q') q: string) {
    const data = await this.faqService.search(tenantId, q ?? '');
    return { success: true, data };
  }

  @Patch('faq/:id')
  @Roles(ROLES.OPERATOR)
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
  ) {
    const data = await this.faqService.update(tenantId, id, dto);
    return { success: true, data };
  }

  @Delete('faq/:id')
  @Roles(ROLES.MANAGER)
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.faqService.remove(tenantId, id);
    return { success: true, data };
  }

  @Post('ai/sales/respond')
  @Roles(ROLES.OPERATOR)
  async respond(@CurrentUser('tenantId') tenantId: string, @Body() dto: SalesRespondDto) {
    const data = await this.salesService.respond(tenantId, dto.question, dto.product_id);
    return { success: true, data };
  }
}
