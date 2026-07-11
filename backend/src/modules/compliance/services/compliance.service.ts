import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DECISION, PROPOSAL_STATUS } from '../compliance.constants';
import { payloadHash } from '../util/payload-hash';
import { PolicyGuardService } from '../engine/policy-guard.service';
import { ApprovalService } from './approval.service';
import { ComplianceAuditService } from './compliance-audit.service';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guard: PolicyGuardService,
    private readonly approval: ApprovalService,
    private readonly audit: ComplianceAuditService,
  ) {}

  /** Core entry point: an agent (or user) proposes an action; we evaluate and route it. */
  async propose(tenantId: string, actor: { userId?: string }, dto: {
    agentId: string;
    actionType: string;
    targetType?: string;
    targetId?: string;
    platform?: string;
    productCategory?: string;
    payload: Record<string, any>;
    idempotencyKey?: string;
  }) {
    const hash = payloadHash(dto.payload ?? {});

    if (dto.idempotencyKey) {
      const existing = await this.prisma.agentActionProposal.findFirst({
        where: { tenantId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return this.getProposal(tenantId, existing.id);
    }

    const proposal = await this.prisma.agentActionProposal.create({
      data: {
        tenantId,
        agentId: dto.agentId,
        actorUserId: actor.userId ?? null,
        actionType: dto.actionType,
        targetType: dto.targetType ?? null,
        targetId: dto.targetId ?? null,
        platform: dto.platform ?? null,
        productCategory: dto.productCategory ?? null,
        payload: (dto.payload ?? {}) as any,
        payloadHash: hash,
        status: PROPOSAL_STATUS.EVALUATING,
        idempotencyKey: dto.idempotencyKey ?? null,
      },
    });

    const decision = await this.guard.evaluate({
      tenantId,
      proposalId: proposal.id,
      agentId: dto.agentId,
      actionType: dto.actionType,
      targetType: dto.targetType,
      targetId: dto.targetId,
      platform: dto.platform,
      productCategory: dto.productCategory,
      payload: dto.payload ?? {},
      payloadHash: hash,
    });

    const status = this.decisionToStatus(decision.decision);
    await this.prisma.agentActionProposal.update({
      where: { id: proposal.id },
      data: { status, riskLevel: decision.riskLevel, policyDecisionId: decision.decisionRecordId ?? null },
    });

    let approvalRequestId: string | null = null;
    if (status === PROPOSAL_STATUS.APPROVAL_REQUIRED) {
      const ar = await this.approval.createForProposal(tenantId, proposal.id, {
        approvalType: decision.decision,
        requestedBy: actor.userId,
        policyDecisionSnapshot: { decision: decision.decision, riskLevel: decision.riskLevel, failedRules: decision.failedRules },
      });
      approvalRequestId = ar.id;
      await this.prisma.agentActionProposal.update({ where: { id: proposal.id }, data: { approvalRequestId } });
    }

    await this.audit.record({
      tenantId,
      actorType: actor.userId ? 'USER' : 'AGENT',
      actorId: actor.userId,
      agentId: dto.agentId,
      action: 'PROPOSAL_EVALUATED',
      entityType: 'proposal',
      entityId: proposal.id,
      policyDecisionId: decision.decisionRecordId,
      result: decision.decision,
      correlationId: decision.correlationId,
      metadata: { actionType: dto.actionType, riskLevel: decision.riskLevel },
    });

    return {
      proposal: { ...proposal, status, riskLevel: decision.riskLevel, approvalRequestId },
      decision,
    };
  }

  private decisionToStatus(decision: string): string {
    switch (decision) {
      case DECISION.ALLOW:
      case DECISION.ALLOW_WITH_LIMIT:
        return PROPOSAL_STATUS.ALLOWED;
      case DECISION.REQUIRE_EDIT:
        return PROPOSAL_STATUS.EDIT_REQUIRED;
      case DECISION.REQUIRE_APPROVAL:
      case DECISION.ESCALATE_LEGAL_REVIEW:
        return PROPOSAL_STATUS.APPROVAL_REQUIRED;
      case DECISION.BLOCK:
      default:
        return PROPOSAL_STATUS.BLOCKED;
    }
  }

  async getProposal(tenantId: string, id: string) {
    const proposal = await this.prisma.agentActionProposal.findFirst({ where: { id, tenantId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    const decision = await this.prisma.policyDecisionRecord.findFirst({ where: { tenantId, proposalId: id }, orderBy: { evaluatedAt: 'desc' } });
    const approval = await this.prisma.complianceApprovalRequest.findFirst({ where: { tenantId, proposalId: id }, orderBy: { createdAt: 'desc' } });
    return { proposal, decision, approval };
  }

  async listProposals(tenantId: string, opts: { limit: number; skip: number; status?: string }) {
    const where: any = { tenantId };
    if (opts.status) where.status = opts.status;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.agentActionProposal.findMany({ where, orderBy: { createdAt: 'desc' }, take: opts.limit, skip: opts.skip }),
      this.prisma.agentActionProposal.count({ where }),
    ]);
    return { rows, total };
  }

  // ---------- Policy versioning (XVIII.2) ----------

  async createPolicy(tenantId: string, dto: any, ownerUserId?: string) {
    return this.prisma.compliancePolicy.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        policyType: dto.policyType,
        jurisdiction: dto.jurisdiction ?? null,
        platform: dto.platform ?? null,
        productCategory: dto.productCategory ?? null,
        version: 1,
        status: 'DRAFT',
        enforcementMode: dto.enforcementMode ?? 'ADVISORY',
        sourceReference: dto.sourceReference ?? null,
        sourceType: dto.sourceType ?? 'INTERNAL',
        reviewDueAt: dto.reviewDueAt ? new Date(dto.reviewDueAt) : null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        ownerUserId: ownerUserId ?? null,
        legalReviewState: dto.legalReviewState ?? 'NEEDS_LEGAL_REVIEW',
        priority: dto.priority ?? 100,
      },
    });
  }

  async listPolicies(tenantId: string, opts: { limit: number; skip: number; status?: string; policyType?: string }) {
    const where: any = { tenantId };
    if (opts.status) where.status = opts.status;
    if (opts.policyType) where.policyType = opts.policyType;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.compliancePolicy.findMany({ where, orderBy: [{ code: 'asc' }, { version: 'desc' }], take: opts.limit, skip: opts.skip }),
      this.prisma.compliancePolicy.count({ where }),
    ]);
    return { rows, total };
  }

  async getPolicy(tenantId: string, id: string) {
    const policy = await this.prisma.compliancePolicy.findFirst({ where: { id, tenantId }, include: { rules: true } });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  /** Clone an ACTIVE/any policy into a new DRAFT version (never edit ACTIVE in place — XVIII.2). */
  async newVersion(tenantId: string, id: string) {
    const base = await this.getPolicy(tenantId, id);
    const maxVersion = await this.prisma.compliancePolicy.aggregate({ where: { tenantId, code: base.code }, _max: { version: true } });
    const nextVersion = (maxVersion._max.version ?? base.version) + 1;
    return this.prisma.compliancePolicy.create({
      data: {
        tenantId,
        code: base.code,
        name: base.name,
        description: base.description,
        policyType: base.policyType,
        jurisdiction: base.jurisdiction,
        platform: base.platform,
        productCategory: base.productCategory,
        version: nextVersion,
        status: 'DRAFT',
        enforcementMode: base.enforcementMode,
        sourceReference: base.sourceReference,
        sourceType: base.sourceType,
        reviewDueAt: base.reviewDueAt,
        legalReviewState: base.legalReviewState,
        priority: base.priority,
      },
    });
  }

  async setPolicyStatus(tenantId: string, id: string, status: string, actor?: { userId?: string }) {
    const policy = await this.getPolicy(tenantId, id);
    const allowed = ['UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'SUPERSEDED', 'ARCHIVED'];
    if (!allowed.includes(status)) throw new BadRequestException('Trạng thái không hợp lệ.');
    if (policy.status === 'ACTIVE' && status === 'ACTIVE') throw new BadRequestException('Policy đã ACTIVE.');

    // Activating: supersede other active versions of the same code.
    if (status === 'ACTIVE') {
      await this.prisma.compliancePolicy.updateMany({
        where: { tenantId, code: policy.code, status: 'ACTIVE', id: { not: policy.id } },
        data: { status: 'SUPERSEDED' },
      });
    }
    const updated = await this.prisma.compliancePolicy.update({
      where: { id: policy.id },
      data: { status, effectiveFrom: status === 'ACTIVE' && !policy.effectiveFrom ? new Date() : policy.effectiveFrom },
    });
    await this.audit.record({
      tenantId,
      actorType: 'USER',
      actorId: actor?.userId,
      action: `POLICY_${status}`,
      entityType: 'policy',
      entityId: policy.id,
      before: { status: policy.status },
      after: { status },
    });
    return updated;
  }

  // ---------- Kill switches (XX) ----------

  async setKillSwitch(tenantId: string, dto: { scope: string; scopeValue?: string; active: boolean; reason?: string; expiresAt?: string }, actor: { userId: string }) {
    const existing = await this.prisma.complianceKillSwitch.findFirst({ where: { tenantId, scope: dto.scope, scopeValue: dto.scopeValue ?? null } });
    const data = {
      active: dto.active,
      reason: dto.reason ?? null,
      activatedBy: actor.userId,
      effectiveFrom: dto.active ? new Date() : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };
    const sw = existing
      ? await this.prisma.complianceKillSwitch.update({ where: { id: existing.id }, data })
      : await this.prisma.complianceKillSwitch.create({ data: { tenantId, scope: dto.scope, scopeValue: dto.scopeValue ?? null, ...data } });
    await this.audit.record({
      tenantId,
      actorType: 'USER',
      actorId: actor.userId,
      action: dto.active ? 'KILL_SWITCH_ACTIVATED' : 'KILL_SWITCH_DEACTIVATED',
      entityType: 'kill_switch',
      entityId: sw.id,
      result: dto.scope,
      metadata: { scopeValue: dto.scopeValue, reason: dto.reason },
    });
    return sw;
  }

  async listKillSwitches(tenantId: string) {
    return this.prisma.complianceKillSwitch.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
  }

  // ---------- Dashboard metrics (XVIII.1) ----------

  async dashboardMetrics(tenantId: string) {
    const now = new Date();
    const [activePolicies, overduePolicies, blocked, pendingApprovals, incidents, assetsPending, productsPending, consentWithdrawals, packsOutdated, highRisk] =
      await Promise.all([
        this.prisma.compliancePolicy.count({ where: { tenantId, status: 'ACTIVE' } }),
        this.prisma.compliancePolicy.count({ where: { tenantId, status: 'ACTIVE', reviewDueAt: { lte: now } } }),
        this.prisma.agentActionProposal.count({ where: { tenantId, status: 'BLOCKED' } }),
        this.prisma.complianceApprovalRequest.count({ where: { tenantId, status: 'PENDING' } }),
        this.prisma.complianceIncident.count({ where: { tenantId, status: { in: ['OPEN', 'INVESTIGATING'] } } }),
        this.prisma.assetRightsRecord.count({ where: { tenantId, verificationStatus: 'PENDING' } }),
        this.prisma.productComplianceProfile.count({ where: { tenantId, complianceClass: 'HUMAN_REVIEW_REQUIRED' } }),
        this.prisma.consentRecord.count({ where: { tenantId, status: 'WITHDRAWN' } }),
        this.prisma.platformPolicyPack.count({ where: { tenantId, OR: [{ status: 'OUTDATED' }, { reviewDueAt: { lte: now } }] } }),
        this.prisma.agentActionProposal.count({ where: { tenantId, riskLevel: { gte: 4 } } }),
      ]);

    const decisionsByType = await this.prisma.policyDecisionRecord.groupBy({
      by: ['decision'],
      where: { tenantId },
      _count: { _all: true },
    });

    return {
      kpis: {
        active_policies: activePolicies,
        policies_overdue_review: overduePolicies,
        actions_blocked: blocked,
        pending_approvals: pendingApprovals,
        incidents: incidents,
        assets_pending_rights: assetsPending,
        products_pending_compliance: productsPending,
        consent_withdrawals: consentWithdrawals,
        platform_packs_outdated: packsOutdated,
        high_risk_actions: highRisk,
      },
      decisions_by_type: decisionsByType.map((d) => ({ decision: d.decision, count: d._count._all })),
    };
  }
}
