import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

export interface LogTaskInput {
  tenantId: string;
  agentName: string;
  taskType: string;
  inputData?: unknown;
  outputData?: unknown;
  modelUsed?: string;
  tokensUsed?: number;
  estimatedCost?: number;
  status?: string;
  errorMessage?: string;
  executionTimeMs?: number;
  triggeredBy?: string;
}

/**
 * Central AI operations service: records every agent task (audit + cost/token
 * tracking) and manages the human-approval boundary for AI-suggested actions.
 */
@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async logTask(input: LogTaskInput) {
    return this.prisma.aiAgentTask.create({
      data: {
        tenantId: input.tenantId,
        agentName: input.agentName,
        taskType: input.taskType,
        inputData: (input.inputData as any) ?? undefined,
        outputData: (input.outputData as any) ?? undefined,
        modelUsed: input.modelUsed ?? null,
        tokensUsed: input.tokensUsed ?? null,
        estimatedCost: input.estimatedCost ?? null,
        status: input.status ?? 'completed',
        errorMessage: input.errorMessage ?? null,
        executionTimeMs: input.executionTimeMs ?? null,
        triggeredBy: input.triggeredBy ?? 'manual',
        completedAt: new Date(),
      },
    });
  }

  async listTasks(tenantId: string, query: PaginationDto, agentName?: string, status?: string) {
    const where: any = { tenantId };
    if (agentName) where.agentName = agentName;
    if (status) where.status = status;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.aiAgentTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.aiAgentTask.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async getTask(tenantId: string, id: string) {
    const task = await this.prisma.aiAgentTask.findFirst({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('AI task not found');
    return task;
  }

  /** Approve an AI task that is awaiting human approval before its action executes. */
  async approveTask(tenantId: string, id: string, userId: string, approved: boolean) {
    const task = await this.getTask(tenantId, id);
    if (task.status !== 'awaiting_approval') {
      throw new ForbiddenException(`Task is not awaiting approval (status: ${task.status})`);
    }
    return this.prisma.aiAgentTask.update({
      where: { id: task.id },
      data: {
        status: approved ? 'approved' : 'rejected',
        approvedBy: userId,
        completedAt: new Date(),
      },
    });
  }

  /** AI cost dashboard aggregation (real data from ai_agent_tasks). */
  async costSummary(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const tasks = await this.prisma.aiAgentTask.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { agentName: true, modelUsed: true, tokensUsed: true, estimatedCost: true },
    });

    const byAgent = new Map<string, { cost: number; tokens: number; count: number }>();
    const byModel = new Map<string, { cost: number; tokens: number }>();
    let totalCost = 0;
    let totalTokens = 0;

    for (const t of tasks) {
      const cost = Number(t.estimatedCost ?? 0);
      const tokens = t.tokensUsed ?? 0;
      totalCost += cost;
      totalTokens += tokens;
      const a = byAgent.get(t.agentName) ?? { cost: 0, tokens: 0, count: 0 };
      a.cost += cost;
      a.tokens += tokens;
      a.count += 1;
      byAgent.set(t.agentName, a);
      const modelKey = t.modelUsed ?? 'unknown';
      const m = byModel.get(modelKey) ?? { cost: 0, tokens: 0 };
      m.cost += cost;
      m.tokens += tokens;
      byModel.set(modelKey, m);
    }

    return {
      period_days: days,
      total_cost: round6(totalCost),
      total_tokens: totalTokens,
      task_count: tasks.length,
      by_agent: [...byAgent.entries()].map(([agent, v]) => ({
        agent,
        cost: round6(v.cost),
        token_usage: v.tokens,
        task_count: v.count,
      })),
      by_model: [...byModel.entries()].map(([model, v]) => ({
        model,
        cost: round6(v.cost),
        token_usage: v.tokens,
      })),
    };
  }
}

function round6(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}
