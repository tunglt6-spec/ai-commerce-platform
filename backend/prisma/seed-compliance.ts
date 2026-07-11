import { PrismaClient } from '@prisma/client';

/**
 * Seeds SAMPLE compliance policies + rules for a tenant. These are development
 * baselines only — flagged NEEDS_LEGAL_REVIEW / NOT_FOR_PRODUCTION and created
 * as DRAFT so nothing enforces until a privileged reviewer activates it (XXV).
 * The deterministic controls in the Policy Guard enforce regardless; these DB
 * rules are the configurable, versioned layer on top.
 */
export async function seedComplianceSamples(prisma: PrismaClient, tenantId: string) {
  const SAMPLE = {
    sourceType: 'SAMPLE',
    legalReviewState: 'NEEDS_LEGAL_REVIEW',
    status: 'DRAFT',
    metadata: { disclaimer: 'SAMPLE — NEEDS_LEGAL_REVIEW — NOT_FOR_PRODUCTION_APPROVAL' } as any,
  };

  const policies: Array<{ code: string; name: string; policyType: string; enforcementMode: string; rules: any[] }> = [
    {
      code: 'DATA_SOURCE_UNVERIFIED',
      name: 'Nguồn dữ liệu chưa xác minh',
      policyType: 'DATA_PRIVACY',
      enforcementMode: 'BLOCK',
      rules: [{ code: 'RULE_UNVERIFIED_SOURCE', name: 'Chặn khai thác nguồn chưa xác minh', ruleType: 'DATA_SOURCE', decision: 'BLOCK', severity: 'HIGH', conditionDefinition: { op: 'eq', field: 'payload.source_verified', value: false } }],
    },
    {
      code: 'ANTI_SCRAPING',
      name: 'Cấm vượt CAPTCHA / né chống bot',
      policyType: 'SECURITY',
      enforcementMode: 'BLOCK',
      rules: [{ code: 'RULE_CAPTCHA_BYPASS', name: 'Chặn CAPTCHA bypass', ruleType: 'PROHIBITED', decision: 'BLOCK', severity: 'CRITICAL', applicableActions: ['captcha_bypass', 'rate_limit_evasion', 'scrape_prohibited'], conditionDefinition: { op: 'always' } }],
    },
    {
      code: 'MARKETING_CONSENT',
      name: 'Marketing cần consent hợp lệ',
      policyType: 'CONSENT',
      enforcementMode: 'BLOCK',
      rules: [{ code: 'RULE_WITHDRAWN_CONSENT', name: 'Chặn marketing khi consent rút', ruleType: 'CONSENT', decision: 'BLOCK', severity: 'HIGH', applicableActions: ['send_marketing', 'launch_campaign'], conditionDefinition: { op: 'eq', field: 'payload.consent_withdrawn', value: true } }],
    },
    {
      code: 'ABSOLUTE_CLAIMS',
      name: 'Tuyên bố tuyệt đối cần bằng chứng',
      policyType: 'ADVERTISING',
      enforcementMode: 'REQUIRE_APPROVAL',
      rules: [{ code: 'RULE_ABSOLUTE_CLAIM', name: 'Yêu cầu sửa nội dung có claim tuyệt đối', ruleType: 'CLAIM', decision: 'REQUIRE_EDIT', severity: 'HIGH', requiresEvidence: true, evidenceTypes: ['CLAIM_EVIDENCE'], conditionDefinition: { op: 'contains_any', field: 'payload.content', value: ['tốt nhất', 'số một', 'duy nhất', 'hiệu quả 100%'] } }],
    },
    {
      code: 'DISCOUNT_LIMIT',
      name: 'Giảm giá vượt ngưỡng cần duyệt',
      policyType: 'AGENT_PERMISSION',
      enforcementMode: 'REQUIRE_APPROVAL',
      rules: [{ code: 'RULE_DISCOUNT_THRESHOLD', name: 'Duyệt khi giảm giá > 10%', ruleType: 'RISK_LIMIT', decision: 'REQUIRE_APPROVAL', severity: 'MEDIUM', applicableActions: ['apply_discount'], conditionDefinition: { op: 'gt', field: 'payload.discount_percent', value: 10 } }],
    },
    {
      code: 'FAKE_REVIEW_BAN',
      name: 'Cấm đánh giá giả',
      policyType: 'CONTENT',
      enforcementMode: 'BLOCK',
      rules: [{ code: 'RULE_FAKE_REVIEW', name: 'Chặn nội dung review giả', ruleType: 'PROHIBITED', decision: 'BLOCK', severity: 'CRITICAL', conditionDefinition: { op: 'contains_any', field: 'payload.content', value: ['review giả', 'đánh giá giả'] } }],
    },
  ];

  for (const p of policies) {
    const existing = await prisma.compliancePolicy.findFirst({ where: { tenantId, code: p.code, version: 1 } });
    const policy = existing ?? (await prisma.compliancePolicy.create({
      data: {
        tenantId, code: p.code, name: p.name, policyType: p.policyType, version: 1,
        enforcementMode: p.enforcementMode, priority: 100,
        reviewDueAt: null,
        ...SAMPLE,
      },
    }));
    for (const r of p.rules) {
      const rExisting = await prisma.complianceRule.findFirst({ where: { tenantId, code: r.code } });
      if (!rExisting) {
        await prisma.complianceRule.create({
          data: {
            tenantId, policyId: policy.id, code: r.code, name: r.name, ruleType: r.ruleType,
            decision: r.decision, severity: r.severity ?? 'MEDIUM', conditionDefinition: r.conditionDefinition,
            applicableActions: r.applicableActions ?? undefined, requiresEvidence: r.requiresEvidence ?? false,
            evidenceTypes: r.evidenceTypes ?? undefined, enabled: true,
          },
        });
      }
    }
  }

  // Sample platform packs: website ACTIVE + fresh; tiktok deliberately OUTDATED to demo freshness control.
  const packs = [
    { platform: 'website', status: 'ACTIVE', reviewDueAt: new Date(Date.now() + 180 * 864e5), officialSource: 'internal' },
    { platform: 'tiktok', status: 'ACTIVE', reviewDueAt: new Date(Date.now() - 5 * 864e5), officialSource: 'SAMPLE — verify at TikTok policy center' },
    { platform: 'email', status: 'ACTIVE', reviewDueAt: new Date(Date.now() + 180 * 864e5), officialSource: 'internal' },
  ];
  for (const pk of packs) {
    const exists = await prisma.platformPolicyPack.findFirst({ where: { tenantId, platform: pk.platform, version: 1 } });
    if (!exists) {
      await prisma.platformPolicyPack.create({
        data: { tenantId, platform: pk.platform, version: 1, status: pk.status, reviewDueAt: pk.reviewDueAt, officialSource: pk.officialSource, sourceReference: 'SAMPLE' },
      });
    }
  }
}
