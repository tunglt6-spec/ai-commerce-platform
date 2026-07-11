import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AGENT_PERMISSION_DEFAULTS, AgentPermissionDefault, UNKNOWN_AGENT_DEFAULT } from './agent-permission.defaults';

export interface EffectivePermission extends AgentPermissionDefault {
  source: 'db' | 'default';
}

export interface PermissionCheck {
  allowed: boolean;
  requiresApproval: boolean;
  denied: boolean;
  reason?: string;
}

/**
 * Resolves the effective permission profile for an agent (DB profile overrides
 * the least-privilege code default) and answers permission questions used by the
 * Policy Guard / Execution Gateway (XIV).
 */
@Injectable()
export class AgentPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  private toStringArray(v: unknown): string[] {
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  }

  async effective(tenantId: string, agentType: string): Promise<EffectivePermission> {
    const now = new Date();
    const profile = await this.prisma.agentPermissionProfile.findFirst({
      where: { tenantId, agentType, active: true },
      orderBy: { version: 'desc' },
    });

    if (profile && (!profile.effectiveFrom || profile.effectiveFrom <= now) && (!profile.effectiveTo || profile.effectiveTo > now)) {
      return {
        source: 'db',
        agentType,
        maximumRiskLevel: profile.maximumRiskLevel,
        allowedActions: this.toStringArray(profile.allowedActions),
        approvalRequiredActions: this.toStringArray(profile.approvalRequiredActions),
        deniedActions: this.toStringArray(profile.deniedActions),
        autoPublishAllowed: profile.autoPublishAllowed,
        maximumDiscountPercent: Number(profile.maximumDiscountPercent),
        maximumOrderValue: Number(profile.maximumOrderValue),
        maximumAdBudget: Number(profile.maximumAdBudget),
        maximumMessageBatch: profile.maximumMessageBatch,
      };
    }

    const def = AGENT_PERMISSION_DEFAULTS[agentType] ?? UNKNOWN_AGENT_DEFAULT;
    return { source: 'default', ...def };
  }

  check(perm: EffectivePermission, action: string): PermissionCheck {
    if (perm.deniedActions.includes(action)) {
      return { allowed: false, requiresApproval: false, denied: true, reason: `Hành động bị cấm với agent ${perm.agentType}.` };
    }
    if (perm.approvalRequiredActions.includes(action)) {
      return { allowed: true, requiresApproval: true, denied: false };
    }
    if (perm.allowedActions.includes(action)) {
      return { allowed: true, requiresApproval: false, denied: false };
    }
    // Not explicitly allowed -> fail-closed: require approval rather than auto-run.
    return { allowed: false, requiresApproval: true, denied: false, reason: `Hành động ngoài phạm vi cho phép của agent ${perm.agentType}.` };
  }
}
