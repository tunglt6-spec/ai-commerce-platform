import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScoringService } from '../ai/agents/scoring.service';
import { buildOrderBy, paginate } from '../../common/dto/pagination.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { WORKFLOWS } from './workflow.registry';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  definitions() {
    return Object.values(WORKFLOWS).map((w) => ({
      name: w.name,
      title: w.title,
      description: w.description,
      schedule_type: 'manual',
    }));
  }

  async run(tenantId: string, name: string, userId: string) {
    const def = WORKFLOWS[name];
    if (!def) throw new NotFoundException('Unknown workflow');

    // Concurrency guard: no duplicate concurrent run of the same workflow per tenant.
    const running = await this.prisma.workflowExecution.findFirst({
      where: { tenantId, workflowName: name, status: 'running' },
    });
    if (running) throw new ConflictException('This workflow is already running for your tenant');

    const exec = await this.prisma.workflowExecution.create({
      data: { tenantId, workflowName: name, scheduleType: 'manual', status: 'running', triggeredBy: userId },
    });

    const start = Date.now();
    try {
      const output = await def.run({ prisma: this.prisma, scoring: this.scoring, tenantId });
      return this.prisma.workflowExecution.update({
        where: { id: exec.id },
        data: {
          status: 'completed',
          outputData: output as any,
          executionTimeMs: Date.now() - start,
          completedAt: new Date(),
        },
      });
    } catch (e) {
      await this.prisma.workflowExecution.update({
        where: { id: exec.id },
        data: {
          status: 'failed',
          errorMessage: (e as Error).message,
          executionTimeMs: Date.now() - start,
          completedAt: new Date(),
        },
      });
      throw e;
    }
  }

  async executions(tenantId: string, query: PaginationDto) {
    const where = { tenantId };
    const orderBy = buildOrderBy(query.sort, { created_at: 'createdAt' }, { createdAt: 'desc' });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workflowExecution.findMany({ where, orderBy, skip: query.skip, take: query.limit }),
      this.prisma.workflowExecution.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async getExecution(tenantId: string, id: string) {
    const exec = await this.prisma.workflowExecution.findFirst({ where: { id, tenantId } });
    if (!exec) throw new NotFoundException('Execution not found');
    return exec;
  }
}
