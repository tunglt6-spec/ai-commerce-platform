import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { stateHash } from '../util/payload-hash';

export interface AuditEntry {
  tenantId: string;
  actorType: 'USER' | 'AGENT' | 'SYSTEM';
  actorId?: string | null;
  agentId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  policyDecisionId?: string | null;
  approvalId?: string | null;
  result?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only compliance audit writer (V.13). Records are written with
 * before/after state hashes. There is intentionally NO update/delete method —
 * retention is a separate privileged archive process (not exposed here).
 */
@Injectable()
export class ComplianceAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    return this.prisma.immutableComplianceAuditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        agentId: entry.agentId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        beforeHash: entry.before !== undefined ? stateHash(entry.before) : null,
        afterHash: entry.after !== undefined ? stateHash(entry.after) : null,
        policyDecisionId: entry.policyDecisionId ?? null,
        approvalId: entry.approvalId ?? null,
        result: entry.result ?? null,
        correlationId: entry.correlationId ?? null,
        metadata: (entry.metadata as any) ?? undefined,
      },
    });
  }

  async query(tenantId: string, opts: { limit: number; skip: number; correlationId?: string; action?: string }) {
    const where: any = { tenantId };
    if (opts.correlationId) where.correlationId = opts.correlationId;
    if (opts.action) where.action = opts.action;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.immutableComplianceAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: opts.skip,
        take: opts.limit,
      }),
      this.prisma.immutableComplianceAuditLog.count({ where }),
    ]);
    return { rows, total };
  }
}
