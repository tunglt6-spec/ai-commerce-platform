/**
 * Kích hoạt (DRAFT -> ACTIVE) các compliance policy ĐÃ ĐƯỢC PHÁP CHẾ DUYỆT
 * cho tenant production, theo xác nhận của admin (Legal Review Register).
 *
 * Chạy TRONG container (có @prisma/client + kết nối DB nội bộ):
 *   docker exec -i ai-commerce-api node < scripts/activate-approved-policies.js
 *
 * An toàn: idempotent (tạo mới nếu chưa có, cập nhật nếu đã có), chỉ đụng
 * compliance_policies/compliance_rules của tenant production; ghi audit bất biến.
 * Bộ 6 policy dưới đây khớp bản mẫu đã bàn giao pháp chế.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.PROD_ADMIN_EMAIL || 'admin@store.local';

const POLICIES = [
  {
    code: 'DATA_SOURCE_UNVERIFIED', name: 'Nguồn dữ liệu chưa xác minh', policyType: 'DATA_PRIVACY',
    enforcementMode: 'BLOCK',
    rules: [{ code: 'RULE_UNVERIFIED_SOURCE', name: 'Chặn khai thác nguồn chưa xác minh', ruleType: 'DATA_SOURCE', decision: 'BLOCK', severity: 'HIGH', conditionDefinition: { op: 'eq', field: 'payload.source_verified', value: false } }],
  },
  {
    code: 'ANTI_SCRAPING', name: 'Cấm vượt CAPTCHA / né chống bot', policyType: 'SECURITY',
    enforcementMode: 'BLOCK',
    rules: [{ code: 'RULE_CAPTCHA_BYPASS', name: 'Chặn CAPTCHA bypass', ruleType: 'PROHIBITED', decision: 'BLOCK', severity: 'CRITICAL', applicableActions: ['captcha_bypass', 'rate_limit_evasion', 'scrape_prohibited'], conditionDefinition: { op: 'always' } }],
  },
  {
    code: 'MARKETING_CONSENT', name: 'Marketing cần consent hợp lệ', policyType: 'CONSENT',
    enforcementMode: 'BLOCK',
    rules: [{ code: 'RULE_WITHDRAWN_CONSENT', name: 'Chặn marketing khi consent rút', ruleType: 'CONSENT', decision: 'BLOCK', severity: 'HIGH', applicableActions: ['send_marketing', 'launch_campaign'], conditionDefinition: { op: 'eq', field: 'payload.consent_withdrawn', value: true } }],
  },
  {
    code: 'ABSOLUTE_CLAIMS', name: 'Tuyên bố tuyệt đối cần bằng chứng', policyType: 'ADVERTISING',
    enforcementMode: 'REQUIRE_APPROVAL',
    rules: [{ code: 'RULE_ABSOLUTE_CLAIM', name: 'Yêu cầu sửa nội dung có claim tuyệt đối', ruleType: 'CLAIM', decision: 'REQUIRE_EDIT', severity: 'HIGH', requiresEvidence: true, evidenceTypes: ['CLAIM_EVIDENCE'], conditionDefinition: { op: 'contains_any', field: 'payload.content', value: ['tốt nhất', 'số một', 'duy nhất', 'hiệu quả 100%'] } }],
  },
  {
    code: 'DISCOUNT_LIMIT', name: 'Giảm giá vượt ngưỡng cần duyệt', policyType: 'AGENT_PERMISSION',
    enforcementMode: 'REQUIRE_APPROVAL',
    rules: [{ code: 'RULE_DISCOUNT_THRESHOLD', name: 'Duyệt khi giảm giá > 10%', ruleType: 'RISK_LIMIT', decision: 'REQUIRE_APPROVAL', severity: 'MEDIUM', applicableActions: ['apply_discount'], conditionDefinition: { op: 'gt', field: 'payload.discount_percent', value: 10 } }],
  },
  {
    code: 'FAKE_REVIEW_BAN', name: 'Cấm đánh giá giả', policyType: 'CONTENT',
    enforcementMode: 'BLOCK',
    rules: [{ code: 'RULE_FAKE_REVIEW', name: 'Chặn nội dung review giả', ruleType: 'PROHIBITED', decision: 'BLOCK', severity: 'CRITICAL', conditionDefinition: { op: 'contains_any', field: 'payload.content', value: ['review giả', 'đánh giá giả'] } }],
  },
];

(async () => {
  const user = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!user) throw new Error(`Không tìm thấy user ${OWNER_EMAIL}`);
  let tenant = await prisma.tenant.findFirst({ where: { ownerId: user.id } });
  if (!tenant) {
    const m = await prisma.userTenant.findFirst({ where: { userId: user.id } });
    if (m) tenant = await prisma.tenant.findUnique({ where: { id: m.tenantId } });
  }
  if (!tenant) throw new Error('Không tìm thấy tenant của admin');
  const tenantId = tenant.id;
  const now = new Date();
  console.log(`Tenant production: ${tenant.name} (${tenantId})`);

  const activated = [];
  for (const pol of POLICIES) {
    let policy = await prisma.compliancePolicy.findFirst({ where: { tenantId, code: pol.code, version: 1 } });
    const data = {
      status: 'ACTIVE', enforcementMode: pol.enforcementMode,
      legalReviewState: 'LEGAL_REVIEWED', approvalStatus: 'APPROVED',
      sourceType: 'INTERNAL', effectiveFrom: now, ownerUserId: user.id,
      metadata: { activated_by: OWNER_EMAIL, basis: 'Admin-confirmed legal approval (Legal Review Register handoff)', activated_at: now.toISOString() },
    };
    if (!policy) {
      policy = await prisma.compliancePolicy.create({
        data: { tenantId, code: pol.code, name: pol.name, policyType: pol.policyType, version: 1, priority: 100, ...data },
      });
    } else {
      policy = await prisma.compliancePolicy.update({ where: { id: policy.id }, data });
    }
    for (const r of pol.rules) {
      const ex = await prisma.complianceRule.findFirst({ where: { tenantId, code: r.code } });
      const rdata = {
        policyId: policy.id, name: r.name, ruleType: r.ruleType, decision: r.decision,
        severity: r.severity || 'MEDIUM', conditionDefinition: r.conditionDefinition,
        applicableActions: r.applicableActions || undefined, requiresEvidence: r.requiresEvidence || false,
        evidenceTypes: r.evidenceTypes || undefined, enabled: true,
      };
      if (!ex) await prisma.complianceRule.create({ data: { tenantId, code: r.code, ...rdata } });
      else await prisma.complianceRule.update({ where: { id: ex.id }, data: rdata });
    }
    activated.push(pol.code);
    console.log(`  ✔ ACTIVE: ${pol.code} (${pol.enforcementMode})`);
  }

  await prisma.immutableComplianceAuditLog.create({
    data: {
      tenantId, actorType: 'USER', actorId: user.id, action: 'POLICY_BULK_ACTIVATED',
      result: `${activated.length} policies ACTIVE`,
      metadata: { codes: activated, basis: 'Admin-confirmed legal approval', at: now.toISOString() },
    },
  });

  const total = await prisma.compliancePolicy.count({ where: { tenantId, status: 'ACTIVE' } });
  console.log(`\nĐã kích hoạt ${activated.length} policy. Tổng ACTIVE trong tenant: ${total}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('LỖI:', e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
