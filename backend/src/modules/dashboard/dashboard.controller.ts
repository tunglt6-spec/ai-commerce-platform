import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('dashboards')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('executive/summary')
  async executive(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.dashboardService.executiveSummary(tenantId);
    return { success: true, data };
  }

  @Get('products/intelligence')
  async products(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.dashboardService.productIntelligence(tenantId);
    return { success: true, data };
  }
}
