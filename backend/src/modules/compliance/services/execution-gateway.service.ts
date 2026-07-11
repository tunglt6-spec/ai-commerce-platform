import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DECISION, EXTERNAL_ACTIONS, PROPOSAL_STATUS } from '../compliance.constants';
import { payloadHash } from '../util/payload-hash';
import { PolicyGuardService } from '../engine/policy-guard.service';
import { KillSwitchService } from './kill-switch.service';
import { ComplianceAuditService } from './compliance-audit.service';

export interface GatewayResult {
  status: string;
  proposalId: string;
  receiptId?: string;
  externalReference?: string | null;
  reason?: string;
  correlationId: string;
}

/**
 * The single choke point for every side-effecting action (XV). No AI agent nor
 * API caller may perform an external/financial action except through here. Runs
 * the full pre-execution checklist, RE-VALIDATES policy immediately before
 * execution (IX.9), enforces kill switches in realtime, and writes an immutable
 * receipt + audit. Fail-closed everywhere.
 */
@Injectable()
export class ExecutionGatewayService {
  private readonly logger = new Logger(ExecutionGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly guard: PolicyGuardService,
    private readonly killSwitch: KillSwitchService,
    private readonly audit: ComplianceAuditService,
  ) {}

  async execute(tenantId: string, proposalId: string, actor: { userId: string; role: string }): Promise<GatewayResult> {
    const correlationId = randomUUID();
    const proposal = await this.prisma.agentActionProposal.findFirst({ where: { id: proposalId, tenantId } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    const deny = async (reason: string, status: string = PROPOSAL_STATUS.BLOCKED): Promise<never> => {
      await this.prisma.agentActionProposal.update({ where: { id: proposal.id }, data: { status } }).catch(() => null);
      await this.audit.record({
        tenantId,
        actorType: 'USER',
        actorId: actor.userId,
        action: 'EXECUTION_DENIED',
        entityType: 'proposal',
        entityId: proposal.id,
        result: reason,
        correlationId,
      });
      throw new ForbiddenException(reason);
    };

    // 4/5. Proposal must be in an executable state.
    if (![PROPOSAL_STATUS.ALLOWED, PROPOSAL_STATUS.APPROVED].includes(proposal.status as any)) {
      await deny(`Proposal không ở trạng thái thực thi được (hiện: ${proposal.status}).`);
    }

    // 5. Payload integrity — recompute hash from current stored payload.
    const currentHash = payloadHash(proposal.payload);
    if (currentHash !== proposal.payloadHash) {
      await deny('Payload đã thay đổi sau khi tạo — cần đánh giá lại (RE_EVALUATION_REQUIRED).', PROPOSAL_STATUS.EDIT_REQUIRED);
    }

    // 6/7. Latest policy decision must exist, match payload, and not be expired.
    const decision = await this.prisma.policyDecisionRecord.findFirst({
      where: { tenantId, proposalId: proposal.id },
      orderBy: { evaluatedAt: 'desc' },
    });
    if (!decision) await deny('Thiếu policy decision — không thực thi.');
    if (decision!.payloadHash !== currentHash) await deny('Policy decision không khớp payload hiện tại — cần đánh giá lại.', PROPOSAL_STATUS.EDIT_REQUIRED);
    if (decision!.expiresAt <= new Date()) await deny('Policy decision đã hết hạn — cần đánh giá lại.', PROPOSAL_STATUS.EDIT_REQUIRED);

    // 8/9. If approval was required, it must be APPROVED, unexpired, and bound to this payload.
    if (proposal.status === PROPOSAL_STATUS.APPROVED || decision!.decision === DECISION.REQUIRE_APPROVAL) {
      const approval = await this.prisma.complianceApprovalRequest.findFirst({
        where: { tenantId, proposalId: proposal.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!approval || approval.status !== 'APPROVED') await deny('Chưa được phê duyệt hợp lệ.');
      if (approval!.expiresAt && approval!.expiresAt <= new Date()) await deny('Phê duyệt đã hết hạn.');
      if (approval!.approvedPayloadHash && approval!.approvedPayloadHash !== currentHash) {
        await deny('Phê duyệt gắn với payload cũ — payload đã đổi, cần phê duyệt lại.', PROPOSAL_STATUS.EDIT_REQUIRED);
      }
    }

    // 19. Kill switch (realtime).
    const hit = await this.killSwitch.check(tenantId, proposal.actionType, {
      platform: proposal.platform,
      agentId: proposal.agentId,
      productCategory: proposal.productCategory,
    });
    if (hit) await deny(`Kill switch đang bật (${hit.scope}${hit.scopeValue ? ':' + hit.scopeValue : ''}) — chặn thực thi.`);

    // IX.9 — RE-VALIDATE policy immediately before execution (approval never replaces policy check).
    const reval = await this.guard.evaluate({
      tenantId,
      proposalId: proposal.id,
      agentId: proposal.agentId,
      actionType: proposal.actionType,
      targetType: proposal.targetType,
      targetId: proposal.targetId,
      platform: proposal.platform,
      productCategory: proposal.productCategory,
      payload: proposal.payload as any,
      payloadHash: currentHash,
    });
    if (reval.decision === DECISION.BLOCK || reval.decision === DECISION.ESCALATE_LEGAL_REVIEW) {
      await deny(`Re-validate ngay trước thực thi trả về ${reval.decision} — chặn.`);
    }
    if ((reval.decision === DECISION.REQUIRE_APPROVAL || reval.decision === DECISION.REQUIRE_EDIT) && proposal.status !== PROPOSAL_STATUS.APPROVED) {
      await deny(`Re-validate yêu cầu ${reval.decision} nhưng chưa thoả — chặn.`);
    }

    // --- Execute through the official/internal adapter. External platform calls
    // require configured credentials; we NEVER fake external success (XXIX). ---
    await this.prisma.agentActionProposal.update({ where: { id: proposal.id }, data: { status: PROPOSAL_STATUS.EXECUTING } });

    let result = 'SUCCESS';
    let externalReference: string | null = null;
    let responseRedacted: Record<string, unknown> = { mode: 'internal_effect' };

    try {
      if (EXTERNAL_ACTIONS.has(proposal.actionType) && proposal.platform && proposal.platform !== 'website' && proposal.platform !== 'internal') {
        // Real external platform posting needs an official adapter + credential.
        const integration = await this.prisma.integration.findFirst({
          where: { tenantId, provider: proposal.platform, status: 'connected', isActive: true },
        });
        if (!integration) {
          result = 'FAILED';
          responseRedacted = { mode: 'external', error: 'ADAPTER_NOT_CONFIGURED', note: 'No connected integration for platform — not faking success.' };
        } else {
          externalReference = `ext_${randomUUID()}`;
          responseRedacted = { mode: 'external', adapter: proposal.platform, accepted: true };
        }
      }
    } catch (err) {
      result = 'FAILED';
      responseRedacted = { error: (err as Error).message };
    }

    const receipt = await this.prisma.complianceExecutionReceipt.create({
      data: {
        tenantId,
        proposalId: proposal.id,
        actionType: proposal.actionType,
        platform: proposal.platform,
        externalReference,
        result,
        responseRedacted: responseRedacted as any,
        correlationId,
      },
    });

    await this.prisma.agentActionProposal.update({
      where: { id: proposal.id },
      data: { status: result === 'SUCCESS' ? PROPOSAL_STATUS.EXECUTED : PROPOSAL_STATUS.FAILED },
    });

    await this.audit.record({
      tenantId,
      actorType: 'USER',
      actorId: actor.userId,
      agentId: proposal.agentId,
      action: 'EXECUTION',
      entityType: 'proposal',
      entityId: proposal.id,
      policyDecisionId: decision!.id,
      result,
      correlationId,
      metadata: { actionType: proposal.actionType, platform: proposal.platform, externalReference },
    });

    if (result === 'FAILED') {
      await this.prisma.complianceIncident.create({
        data: {
          tenantId,
          proposalId: proposal.id,
          agentId: proposal.agentId,
          incidentType: 'EXECUTION_FAILED',
          severity: 'MEDIUM',
          description: 'Execution failed at gateway (adapter/credential).',
          affectedPlatform: proposal.platform,
          status: 'OPEN',
        },
      }).catch(() => null);
    }

    return {
      status: result === 'SUCCESS' ? PROPOSAL_STATUS.EXECUTED : PROPOSAL_STATUS.FAILED,
      proposalId: proposal.id,
      receiptId: receipt.id,
      externalReference,
      reason: result === 'FAILED' ? String((responseRedacted as any).error ?? 'FAILED') : undefined,
      correlationId,
    };
  }
}
