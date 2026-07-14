import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ROLES } from '../../../common/constants/roles';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { EmailService } from './email.service';
import { ConnectEmailDto, SendEmailDto, TestEmailDto } from './dto/email.dto';

@Controller('integrations/email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Get('status')
  async status(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: await this.email.status(tenantId) };
  }

  /** Store SMTP credentials (password encrypted at rest). */
  @Post('connect')
  @Roles(ROLES.ADMIN)
  async connect(@CurrentUser('tenantId') tenantId: string, @Body() dto: ConnectEmailDto) {
    return { success: true, data: await this.email.connect(tenantId, dto) };
  }

  /** Send a real test email (defaults to the from_email) and flip status connected/error. */
  @Post('test')
  @Roles(ROLES.MANAGER)
  async test(@CurrentUser() user: AuthenticatedUser, @Body() dto: TestEmailDto) {
    return { success: true, data: await this.email.test(user.tenantId, dto.to || user.email) };
  }

  /** Send a transactional email via the tenant's SMTP. */
  @Post('send')
  @Roles(ROLES.OPERATOR)
  async send(@CurrentUser('tenantId') tenantId: string, @Body() dto: SendEmailDto) {
    return { success: true, data: await this.email.send(tenantId, dto) };
  }

  @Post('disconnect')
  @Roles(ROLES.ADMIN)
  async disconnect(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: await this.email.disconnect(tenantId) };
  }
}
