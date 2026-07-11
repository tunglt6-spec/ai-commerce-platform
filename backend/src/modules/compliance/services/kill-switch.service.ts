import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EXTERNAL_ACTIONS, FINANCIAL_ACTIONS, KILL_SWITCH_SCOPE, MARKETING_ACTIONS, ACTION } from '../compliance.constants';

export interface KillSwitchHit {
  scope: string;
  scopeValue?: string | null;
  reason?: string | null;
}

/**
 * Kill switches (XX). Checked in realtime by the Execution Gateway. Active +
 * (no expiry OR not yet expired) + effective => the switch blocks the action.
 */
@Injectable()
export class KillSwitchService {
  constructor(private readonly prisma: PrismaService) {}

  private isLive(sw: { active: boolean; effectiveFrom: Date | null; expiresAt: Date | null }, now: Date): boolean {
    if (!sw.active) return false;
    if (sw.effectiveFrom && sw.effectiveFrom > now) return false;
    if (sw.expiresAt && sw.expiresAt <= now) return false;
    return true;
  }

  /** Returns the first kill switch that blocks this action, or null. */
  async check(tenantId: string, action: string, opts: { platform?: string | null; agentId?: string | null; productCategory?: string | null }): Promise<KillSwitchHit | null> {
    const switches = await this.prisma.complianceKillSwitch.findMany({ where: { tenantId, active: true } });
    const now = new Date();

    for (const sw of switches) {
      if (!this.isLive(sw, now)) continue;
      const hit = (): KillSwitchHit => ({ scope: sw.scope, scopeValue: sw.scopeValue, reason: sw.reason });

      switch (sw.scope) {
        case KILL_SWITCH_SCOPE.ALL_EXTERNAL:
          if (EXTERNAL_ACTIONS.has(action)) return hit();
          break;
        case KILL_SWITCH_SCOPE.AUTO_PUBLISH:
          if (action === ACTION.PUBLISH_CONTENT || action === ACTION.SYNC_MARKETPLACE) return hit();
          break;
        case KILL_SWITCH_SCOPE.AD_LAUNCH:
          if (action === ACTION.LAUNCH_PAID_AD) return hit();
          break;
        case KILL_SWITCH_SCOPE.OUTBOUND_MARKETING:
          if (MARKETING_ACTIONS.has(action)) return hit();
          break;
        case KILL_SWITCH_SCOPE.FINANCIAL:
          if (FINANCIAL_ACTIONS.has(action)) return hit();
          break;
        case KILL_SWITCH_SCOPE.DATA_COLLECTION:
          if (action === ACTION.SCRAPE_PROHIBITED || action.startsWith('collect')) return hit();
          break;
        case KILL_SWITCH_SCOPE.PLATFORM:
          if (opts.platform && sw.scopeValue && opts.platform === sw.scopeValue) return hit();
          break;
        case KILL_SWITCH_SCOPE.AGENT:
          if (opts.agentId && sw.scopeValue && opts.agentId === sw.scopeValue) return hit();
          break;
        case KILL_SWITCH_SCOPE.RISKY_CATEGORY:
          if (opts.productCategory && sw.scopeValue && opts.productCategory === sw.scopeValue) return hit();
          break;
        default:
          break;
      }
    }
    return null;
  }
}
