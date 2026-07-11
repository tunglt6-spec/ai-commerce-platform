import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

/** Management reporting + CSV export. All endpoints are tenant-scoped and MANAGER+. */
@Controller('reports')
@Roles(ROLES.MANAGER)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  async sales(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = this.reports.resolveRange(from, to);
    const data = await this.reports.salesReport(tenantId, range);
    return { success: true, data };
  }

  @Get('products')
  async products(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = this.reports.resolveRange(from, to);
    const data = await this.reports.productsReport(tenantId, range);
    return { success: true, data };
  }

  @Get('customers')
  async customers(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.reports.customersReport(tenantId);
    return { success: true, data };
  }

  @Get('ai-cost')
  async aiCost(@CurrentUser('tenantId') tenantId: string, @Query('days') days?: string) {
    const data = await this.reports.aiCostReport(tenantId, parseInt(days ?? '30', 10) || 30);
    return { success: true, data };
  }

  @Get('export/:type')
  async export(
    @CurrentUser('tenantId') tenantId: string,
    @Param('type') type: string,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
  ): Promise<string> {
    const range = this.reports.resolveRange(from, to);
    const { filename, csv } = await this.reports.exportCsv(
      tenantId,
      type,
      range,
      parseInt(days ?? '30', 10) || 30,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }
}
