import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  DECISION,
  DECISION_SEVERITY,
  DECISION_TTL_MS,
  Decision,
  EVALUATOR_VERSION,
  FINANCIAL_ACTIONS,
  MARKETING_ACTIONS,
  RISK,
  RISK_LABEL,
} from '../compliance.constants';
import { RuleEvaluatorService } from './rule-evaluator.service';
import { ContentScannerService } from './content-scanner.service';
import { RiskService } from './risk.service';
import { AgentPermissionService } from '../services/agent-permission.service';

export interface ProposalInput {
  tenantId: string;
  proposalId: string;
  agentId: string;
  actionType: string;
  targetType?: string | null;
  targetId?: string | null;
  platform?: string | null;
  productCategory?: string | null;
  payload: Record<string, any>;
  payloadHash: string;
}

export interface PolicyDecision {
  decision: Decision;
  riskScore: number;
  riskLevel: number;
  riskLabel: string;
  matchedRules: any[];
  failedRules: any[];
  warnings: string[];
  requiredEdits: string[];
  requiredEvidence: string[];
  limits: Record<string, any>;
  policyVersionSet: { code: string; version: number }[];
  policySnapshot: any[];
  expiresAt: string;
  correlationId: string;
  payloadHash: string;
  evaluatorVersion: string;
  reasons: string[];
  decisionRecordId?: string;
}

@Injectable()
export class PolicyGuardService {
  private readonly logger = new Logger(PolicyGuardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RuleEvaluatorService,
    private readonly scanner: ContentScannerService,
    private readonly risk: RiskService,
    private readonly perms: AgentPermissionService,
  ) {}

  private worst(a: Decision, b: Decision): Decision {
    return DECISION_SEVERITY[a] >= DECISION_SEVERITY[b] ? a : b;
  }

  async evaluate(input: ProposalInput): Promise<PolicyDecision> {
    const correlationId = randomUUID();
    const warnings: string[] = [];
    const requiredEdits: string[] = [];
    const requiredEvidence: string[] = [];
    const matchedRules: any[] = [];
    const failedRules: any[] = [];
    const limits: Record<string, any> = {};
    const reasons: string[] = [];
    let decision: Decision = DECISION.ALLOW;

    try {
      const perm = await this.perms.effective(input.tenantId, input.agentId);
      const permCheck = this.perms.check(perm, input.actionType);

      // --- Content scan (deterministic, authoritative) ---
      const text = [input.payload?.content, input.payload?.title, input.payload?.caption, input.payload?.message]
        .filter(Boolean)
        .join('\n');
      const scan = this.scanner.scan(text, { approvedClaimTerms: input.payload?.approved_claim_terms });
      if (scan.hasBlocking) {
        decision = this.worst(decision, DECISION.BLOCK);
        for (const f of scan.findings.filter((x) => x.severity === 'CRITICAL')) {
          failedRules.push({ code: 'CONTENT_PROHIBITED', message: f.message });
          reasons.push(f.message);
        }
      }
      if (scan.hasClaimRequiringEvidence) {
        for (const f of scan.findings.filter((x) => x.type === 'absolute_claim')) {
          requiredEdits.push(f.message);
          requiredEvidence.push(`CLAIM_EVIDENCE:${f.term}`);
        }
        decision = this.worst(decision, DECISION.REQUIRE_EDIT);
      }

      // --- Product compliance ---
      const productId = input.payload?.product_id ?? (input.targetType === 'product' ? input.targetId : undefined);
      if (productId) {
        const prod = await this.prisma.productComplianceProfile.findFirst({
          where: { tenantId: input.tenantId, productId },
        });
        if (!prod) {
          warnings.push('Sản phẩm chưa có compliance profile — không auto-publish.');
          decision = this.worst(decision, DECISION.REQUIRE_APPROVAL);
        } else {
          if (prod.complianceClass === 'PROHIBITED') {
            failedRules.push({ code: 'PRODUCT_PROHIBITED', message: 'Sản phẩm bị cấm bán/quảng cáo.' });
            decision = this.worst(decision, DECISION.BLOCK);
          } else if (prod.complianceClass === 'LICENSE_REQUIRED') {
            const licenses = await this.prisma.evidenceRecord.count({
              where: {
                tenantId: input.tenantId,
                referenceType: 'product',
                referenceId: productId,
                evidenceType: { in: ['PRODUCT_LICENSE', 'PRODUCT_CERTIFICATE'] },
                verificationStatus: 'VERIFIED',
              },
            });
            if (licenses === 0) {
              failedRules.push({ code: 'PRODUCT_LICENSE_MISSING', message: 'Thiếu giấy phép/chứng nhận sản phẩm.' });
              requiredEvidence.push('PRODUCT_LICENSE');
              decision = this.worst(decision, DECISION.BLOCK);
            }
          } else if (prod.complianceClass === 'RESTRICTED' || prod.complianceClass === 'HUMAN_REVIEW_REQUIRED') {
            decision = this.worst(decision, DECISION.REQUIRE_APPROVAL);
          }
          if (input.platform && Array.isArray(prod.prohibitedPlatforms) && (prod.prohibitedPlatforms as string[]).includes(input.platform)) {
            failedRules.push({ code: 'PLATFORM_RESTRICTED_PRODUCT', message: `Sản phẩm bị cấm trên ${input.platform}.` });
            decision = this.worst(decision, DECISION.BLOCK);
          }
        }
      }

      // --- Marketing consent (before any outbound marketing) ---
      if (MARKETING_ACTIONS.has(input.actionType)) {
        const customerId = input.payload?.customer_id;
        const channel = input.payload?.channel;
        if (!customerId || !channel) {
          failedRules.push({ code: 'CONSENT_CONTEXT_MISSING', message: 'Thiếu khách hàng/kênh để kiểm tra consent.' });
          decision = this.worst(decision, DECISION.BLOCK);
        } else {
          const consent = await this.prisma.consentRecord.findFirst({
            where: { tenantId: input.tenantId, customerId, channel, purpose: { in: ['MARKETING', 'REMARKETING'] } },
            orderBy: { version: 'desc' },
          });
          const valid = consent && consent.status === 'GRANTED' && (!consent.expiresAt || consent.expiresAt > new Date()) && !consent.withdrawnAt;
          if (!valid) {
            failedRules.push({ code: 'MARKETING_CONSENT_INVALID', message: 'Consent marketing không hợp lệ hoặc đã rút.' });
            decision = this.worst(decision, DECISION.BLOCK);
          }
        }
      }

      // --- Asset rights (external publish / paid ad) ---
      const assetIds: string[] = Array.isArray(input.payload?.asset_ids) ? input.payload.asset_ids : [];
      if (assetIds.length && (input.actionType.startsWith('publish') || input.actionType.startsWith('launch') || input.actionType.startsWith('send'))) {
        for (const assetId of assetIds) {
          const asset = await this.prisma.assetRightsRecord.findFirst({ where: { tenantId: input.tenantId, assetId } });
          const verified = asset && asset.verificationStatus === 'VERIFIED' && (!asset.validUntil || asset.validUntil > new Date());
          if (!verified) {
            failedRules.push({ code: 'ASSET_RIGHTS_UNVERIFIED', message: `Tài sản ${assetId} chưa xác minh quyền hoặc hết hạn.` });
            requiredEvidence.push(`ASSET_RIGHTS:${assetId}`);
            decision = this.worst(decision, input.actionType === 'launch_paid_ad' ? DECISION.BLOCK : DECISION.REQUIRE_APPROVAL);
          } else if (input.actionType === 'launch_paid_ad' && !asset.paidAdsAllowed) {
            failedRules.push({ code: 'ASSET_NO_PAID_ADS', message: `Tài sản ${assetId} không cho phép chạy quảng cáo trả phí.` });
            decision = this.worst(decision, DECISION.BLOCK);
          }
        }
      }

      // --- Platform policy pack freshness (auto-publish) ---
      if (input.platform && (input.actionType === 'publish_content' || input.actionType === 'launch_paid_ad' || input.actionType === 'sync_marketplace')) {
        const pack = await this.prisma.platformPolicyPack.findFirst({
          where: { tenantId: input.tenantId, platform: input.platform, status: 'ACTIVE' },
          orderBy: { version: 'desc' },
        });
        const stale = !pack || (pack.reviewDueAt && pack.reviewDueAt <= new Date());
        if (stale) {
          warnings.push(`Platform pack '${input.platform}' quá hạn rà soát — tắt auto-publish.`);
          limits.autoPublish = false;
          decision = this.worst(decision, DECISION.REQUIRE_APPROVAL);
        }
      }

      // --- DB compliance rules (versioned, active policies only) ---
      const ctx = {
        action: input.actionType,
        platform: input.platform,
        productCategory: input.productCategory,
        agent: input.agentId,
        payload: input.payload,
      };
      const activeRules = await this.prisma.complianceRule.findMany({
        where: { tenantId: input.tenantId, enabled: true, policy: { status: 'ACTIVE' } },
        include: { policy: { select: { code: true, version: true, enforcementMode: true } } },
      });
      const policyVersionSet: { code: string; version: number }[] = [];
      const policySnapshot: any[] = [];
      for (const rule of activeRules) {
        if (!this.applies(rule, input)) continue;
        const hit = this.rules.evaluate(rule.conditionDefinition as any, ctx);
        if (hit) {
          const ruleDecision = String(rule.decision) as Decision;
          matchedRules.push({ code: rule.code, decision: ruleDecision, severity: rule.severity });
          policyVersionSet.push({ code: rule.policy.code, version: rule.policy.version });
          policySnapshot.push({ ruleCode: rule.code, policyCode: rule.policy.code, decision: ruleDecision });
          if (DECISION_SEVERITY[ruleDecision] > DECISION_SEVERITY[DECISION.ALLOW]) {
            failedRules.push({ code: rule.code, message: rule.remediationInstruction ?? rule.name, decision: ruleDecision });
          }
          decision = this.worst(decision, ruleDecision);
          if (rule.requiresEvidence) requiredEvidence.push(...(Array.isArray(rule.evidenceTypes) ? (rule.evidenceTypes as string[]) : []));
        }
      }

      // --- Agent permission gate ---
      if (permCheck.denied) {
        failedRules.push({ code: 'AGENT_ACTION_DENIED', message: permCheck.reason });
        decision = this.worst(decision, DECISION.BLOCK);
      } else if (permCheck.requiresApproval) {
        decision = this.worst(decision, DECISION.REQUIRE_APPROVAL);
      }

      // --- Risk model ---
      const riskFactors = {
        actionType: input.actionType,
        platform: input.platform,
        productCategory: input.productCategory,
        hasClaims: scan.hasClaimRequiringEvidence,
        evidenceMissing: requiredEvidence.length > 0,
        consentInvalid: failedRules.some((r) => r.code === 'MARKETING_CONSENT_INVALID'),
        financialImpact: Number(input.payload?.financial_impact ?? input.payload?.order_value ?? 0),
        batchSize: Number(input.payload?.batch_size ?? 0),
        agentMaxRisk: perm.maximumRiskLevel,
      };
      const riskResult = this.risk.score(riskFactors);
      reasons.push(...riskResult.reasons);

      // --- Hard risk-based rules ---
      if (riskResult.riskLevel >= RISK.PROHIBITED) {
        decision = DECISION.BLOCK; // prohibited automation always blocks
        failedRules.push({ code: 'PROHIBITED_AUTOMATION', message: 'Hành động thuộc nhóm bị cấm tuyệt đối.' });
      } else {
        // Financial/legal actions always need approval floor (VII RISK 4).
        if (FINANCIAL_ACTIONS.has(input.actionType)) {
          // Agent auto-limit for small discounts still requires approval per spec (RISK 4).
          decision = this.worst(decision, DECISION.REQUIRE_APPROVAL);
        }
        // Agent exceeding its own max risk cannot auto-run.
        if (riskResult.riskLevel > perm.maximumRiskLevel && DECISION_SEVERITY[decision] < DECISION_SEVERITY[DECISION.REQUIRE_APPROVAL]) {
          decision = this.worst(decision, DECISION.REQUIRE_APPROVAL);
          warnings.push('Rủi ro vượt mức cho phép của agent — cần phê duyệt.');
        }
      }

      // Limits surfaced for ALLOW_WITH_LIMIT
      if (input.actionType === 'apply_discount') limits.maxDiscountPercent = perm.maximumDiscountPercent;
      if (input.actionType === 'create_high_value_order') limits.maxOrderValue = perm.maximumOrderValue;
      if (MARKETING_ACTIONS.has(input.actionType)) limits.maxMessageBatch = perm.maximumMessageBatch;

      const now = Date.now();
      const record = await this.prisma.policyDecisionRecord.create({
        data: {
          tenantId: input.tenantId,
          proposalId: input.proposalId,
          decision,
          riskScore: riskResult.riskScore,
          riskLevel: riskResult.riskLevel,
          matchedRules,
          failedRules,
          warnings,
          requiredEdits,
          requiredEvidence,
          limits,
          policySnapshot,
          policyVersionSet,
          evaluatorVersion: EVALUATOR_VERSION,
          expiresAt: new Date(now + DECISION_TTL_MS),
          correlationId,
          payloadHash: input.payloadHash,
        },
      }).catch(() => null);

      return {
        decision,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        riskLabel: RISK_LABEL[riskResult.riskLevel],
        matchedRules,
        failedRules,
        warnings,
        requiredEdits,
        requiredEvidence: [...new Set(requiredEvidence)],
        limits,
        policyVersionSet,
        policySnapshot,
        expiresAt: new Date(now + DECISION_TTL_MS).toISOString(),
        correlationId,
        payloadHash: input.payloadHash,
        evaluatorVersion: EVALUATOR_VERSION,
        reasons,
        decisionRecordId: record?.id,
      };
    } catch (err) {
      // Fail-closed: never ALLOW on evaluator error.
      this.logger.error(`Policy evaluation error: ${(err as Error).message}`);
      return {
        decision: DECISION.BLOCK,
        riskScore: 100,
        riskLevel: RISK.FINANCIAL_OR_LEGAL,
        riskLabel: RISK_LABEL[RISK.FINANCIAL_OR_LEGAL],
        matchedRules: [],
        failedRules: [{ code: 'POLICY_ENGINE_ERROR', message: 'Policy engine lỗi — chặn để an toàn (fail-closed).' }],
        warnings: [],
        requiredEdits: [],
        requiredEvidence: [],
        limits: {},
        policyVersionSet: [],
        policySnapshot: [],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        correlationId,
        payloadHash: input.payloadHash,
        evaluatorVersion: EVALUATOR_VERSION,
        reasons: ['fail-closed'],
      };
    }
  }

  private applies(rule: { applicableActions: any; applicableAgents: any; applicablePlatforms: any; applicableProductCategories: any }, input: ProposalInput): boolean {
    const match = (list: any, value: any) => {
      if (!Array.isArray(list) || list.length === 0) return true; // empty = applies to all
      return list.map((x) => String(x)).includes(String(value));
    };
    return (
      match(rule.applicableActions, input.actionType) &&
      match(rule.applicableAgents, input.agentId) &&
      match(rule.applicablePlatforms, input.platform) &&
      match(rule.applicableProductCategories, input.productCategory)
    );
  }
}
