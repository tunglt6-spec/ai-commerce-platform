import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ROLE_RANK } from '../../../common/constants/roles';
import { APPROVAL_TTL_MS, FINANCIAL_ACTIONS, PROPOSAL_STATUS } from '../compliance.constants';
import { ComplianceAuditService } from './compliance-audit.service';

/**
 * Human approval workflow with separation of duties (XVI). Approvals are bound
 * to a payload hash; a later payload change invalidates the approval.
 */
@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ComplianceAuditService,
  ) {}

  async createForProposal(tenantId: string, proposalId: string, opts: { approvalType: string; assignedRole?: string; requestedBy?: string; policyDecisionSnapshot?: unknown }) {
    return this.prisma.complianceApprovalRequest.create({
      data: {
        tenantId,
        proposalId,
        approvalType: opts.approvalType,
        assignedRole: opts.assignedRole ?? 'manager',
        requestedBy: opts.requestedBy ?? null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
        policyDecisionSnapshot: (opts.policyDecisionSnapshot as any) ?? undefined,
      },
    });
  }

  async listPending(tenantId: string, limit: number, skip: number) {
    const where = { tenantId, status: 'PENDING' as const };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.complianceApprovalRequest.findMany({ where, orderBy: { createdAt: 'asc' }, take: limit, skip }),
      this.prisma.complianceApprovalRequest.count({ where }),
    ]);
    return { rows, total };
  }

  async decide(tenantId: string, approvalId: string, decider: { userId: string; role: string }, approved: boolean, note?: string) {
    const approval = await this.prisma.complianceApprovalRequest.findFirst({ where: { id: approvalId, tenantId } });
    if (!approval) throw new NotFoundException('Approval request not found');
    if (approval.status !== 'PENDING') throw new BadRequestException(`Approval không ở trạng thái PENDING (hiện: ${approval.status}).`);
    if (approval.expiresAt && approval.expiresAt <= new Date()) {
      await this.prisma.complianceApprovalRequest.update({ where: { id: approval.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Approval đã hết hạn.');
    }

    const proposal = await this.prisma.agentActionProposal.findFirst({ where: { id: approval.proposalId, tenantId } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    // Separation of duties: minimum manager, and requester cannot self-approve financial actions.
    if ((ROLE_RANK[decider.role as keyof typeof ROLE_RANK] ?? 0) < ROLE_RANK.manager) {
      throw new ForbiddenException('Cần quyền Manager trở lên để phê duyệt.');
    }
    if (FINANCIAL_ACTIONS.has(proposal.actionType) && proposal.actorUserId && proposal.actorUserId === decider.userId) {
      throw new ForbiddenException('Người tạo đề xuất không được tự phê duyệt hành động tài chính (separation of duties).');
    }

    const updated = await this.prisma.complianceApprovalRequest.update({
      where: { id: approval.id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        decidedBy: decider.userId,
        decidedAt: new Date(),
        decisionNote: note ?? null,
        // Bind approval to the EXACT payload that exists now (X.10, XVI).
        approvedPayloadHash: approved ? proposal.payloadHash : null,
      },
    });

    await this.prisma.agentActionProposal.update({
      where: { id: proposal.id },
      data: { status: approved ? PROPOSAL_STATUS.APPROVED : PROPOSAL_STATUS.REJECTED },
    });

    await this.audit.record({
      tenantId,
      actorType: 'USER',
      actorId: decider.userId,
      action: approved ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
      entityType: 'proposal',
      entityId: proposal.id,
      approvalId: approval.id,
      result: approved ? 'APPROVED' : 'REJECTED',
      metadata: { note },
    });

    return updated;
  }
}
