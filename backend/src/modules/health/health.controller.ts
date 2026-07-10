import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — process is up. */
  @Public()
  @Get()
  live() {
    return { status: 'ok', service: 'ai-commerce-backend', timestamp: new Date().toISOString() };
  }

  /** Readiness — dependencies (DB) reachable. */
  @Public()
  @Get('ready')
  async ready() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return {
      status: db ? 'ready' : 'degraded',
      checks: { database: db ? 'up' : 'down' },
      timestamp: new Date().toISOString(),
    };
  }
}
