import { Controller, Post } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';

@Controller('ai/analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post('insights')
  @Roles(ROLES.MANAGER)
  async insights(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.analyzeService.insights(tenantId);
    return { success: true, data };
  }
}
