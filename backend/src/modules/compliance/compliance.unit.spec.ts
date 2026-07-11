import { RuleEvaluatorService } from './engine/rule-evaluator.service';
import { ContentScannerService } from './engine/content-scanner.service';
import { RiskService } from './engine/risk.service';
import { AgentPermissionService } from './services/agent-permission.service';
import { AGENT_PERMISSION_DEFAULTS, UNKNOWN_AGENT_DEFAULT } from './services/agent-permission.defaults';
import { payloadHash } from './util/payload-hash';
import { ACTION, RISK } from './compliance.constants';

describe('Compliance engine (unit, deterministic)', () => {
  describe('RuleEvaluatorService', () => {
    const ev = new RuleEvaluatorService();

    it('evaluates and/or/not', () => {
      const ctx = { a: 1, b: 2 };
      expect(ev.evaluate({ op: 'and', rules: [{ op: 'eq', field: 'a', value: 1 }, { op: 'eq', field: 'b', value: 2 }] }, ctx)).toBe(true);
      expect(ev.evaluate({ op: 'or', rules: [{ op: 'eq', field: 'a', value: 9 }, { op: 'eq', field: 'b', value: 2 }] }, ctx)).toBe(true);
      expect(ev.evaluate({ op: 'not', rule: { op: 'eq', field: 'a', value: 1 } }, ctx)).toBe(false);
    });

    it('supports comparisons and membership', () => {
      const ctx = { payload: { discount: 30 }, platform: 'tiktok' };
      expect(ev.evaluate({ op: 'gt', field: 'payload.discount', value: 20 }, ctx)).toBe(true);
      expect(ev.evaluate({ op: 'in', field: 'platform', value: ['tiktok', 'shopee'] }, ctx)).toBe(true);
      expect(ev.evaluate({ op: 'nin', field: 'platform', value: ['website'] }, ctx)).toBe(true);
    });

    it('contains_any is case-insensitive on nested text', () => {
      const ctx = { payload: { content: 'Sản phẩm TỐT NHẤT thị trường' } };
      expect(ev.evaluate({ op: 'contains_any', field: 'payload.content', value: ['tốt nhất'] }, ctx)).toBe(true);
    });

    it('fails closed on unknown operator and null condition', () => {
      expect(ev.evaluate({ op: 'wat' } as any, {})).toBe(false);
      expect(ev.evaluate(null, {})).toBe(false);
    });
  });

  describe('ContentScannerService', () => {
    const s = new ContentScannerService();

    it('flags absolute claim requiring evidence', () => {
      const r = s.scan('Kem này tuyệt đối an toàn cho da');
      expect(r.hasClaimRequiringEvidence).toBe(true);
      expect(r.findings.some((f) => f.type === 'absolute_claim')).toBe(true);
    });

    it('blocks prohibited content (fake review)', () => {
      const r = s.scan('Đăng review giả để tăng uy tín');
      expect(r.hasBlocking).toBe(true);
    });

    it('allows an approved claim term', () => {
      const r = s.scan('Sản phẩm số một', { approvedClaimTerms: ['số một'] });
      expect(r.hasClaimRequiringEvidence).toBe(false);
    });

    it('passes clean content', () => {
      const r = s.scan('Áo thun cotton thoáng mát, nhiều màu.');
      expect(r.hasBlocking).toBe(false);
      expect(r.hasClaimRequiringEvidence).toBe(false);
    });
  });

  describe('RiskService', () => {
    const r = new RiskService();

    it('uses action base risk', () => {
      expect(r.score({ actionType: ACTION.GENERATE_INSIGHT }).riskLevel).toBe(RISK.READ_ONLY);
      expect(r.score({ actionType: ACTION.REFUND }).riskLevel).toBe(RISK.FINANCIAL_OR_LEGAL);
      expect(r.score({ actionType: ACTION.FAKE_REVIEW }).riskLevel).toBe(RISK.PROHIBITED);
    });

    it('escalates unknown actions (fail-closed)', () => {
      const out = r.score({ actionType: 'totally_unknown_action' });
      expect(out.riskLevel).toBeGreaterThanOrEqual(RISK.FINANCIAL_OR_LEGAL);
    });

    it('raises score for sensitive/consent/evidence factors', () => {
      const base = r.score({ actionType: ACTION.SEND_MARKETING }).riskScore;
      const worse = r.score({ actionType: ACTION.SEND_MARKETING, consentInvalid: true, evidenceMissing: true, batchSize: 100 }).riskScore;
      expect(worse).toBeGreaterThan(base);
    });
  });

  describe('AgentPermissionService.check (fail-closed)', () => {
    const svc = new AgentPermissionService({} as any);
    const perm = { source: 'default' as const, ...AGENT_PERMISSION_DEFAULTS.content_ai };

    it('denies explicitly denied actions', () => {
      expect(svc.check(perm, ACTION.FAKE_REVIEW).denied).toBe(true);
    });
    it('requires approval for approval-listed actions', () => {
      expect(svc.check(perm, ACTION.PUBLISH_CONTENT).requiresApproval).toBe(true);
    });
    it('allows explicitly allowed actions', () => {
      expect(svc.check(perm, ACTION.GENERATE_CONTENT_DRAFT).allowed).toBe(true);
    });
    it('fails closed (requires approval) for unlisted actions', () => {
      const out = svc.check(perm, ACTION.REFUND);
      expect(out.allowed).toBe(false);
      expect(out.requiresApproval).toBe(true);
    });
    it('unknown agent default is read-only', () => {
      expect(UNKNOWN_AGENT_DEFAULT.maximumRiskLevel).toBe(RISK.READ_ONLY);
    });
  });

  describe('payloadHash', () => {
    it('is order-independent', () => {
      expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
    });
    it('changes when payload mutates', () => {
      expect(payloadHash({ discount: 10 })).not.toBe(payloadHash({ discount: 20 }));
    });
  });
});
