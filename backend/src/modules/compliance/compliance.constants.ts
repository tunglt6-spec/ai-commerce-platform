/**
 * Compliance & Policy Guard — shared constants and typed enums.
 * The whole layer is deterministic and fail-closed; LLM output never overrides
 * these controls.
 */

export const EVALUATOR_VERSION = 'policy-guard-1.0.0';

/** Policy decisions (VI. Policy Decision Contract). */
export const DECISION = {
  ALLOW: 'ALLOW',
  ALLOW_WITH_LIMIT: 'ALLOW_WITH_LIMIT',
  REQUIRE_EDIT: 'REQUIRE_EDIT',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  BLOCK: 'BLOCK',
  ESCALATE_LEGAL_REVIEW: 'ESCALATE_LEGAL_REVIEW',
} as const;
export type Decision = (typeof DECISION)[keyof typeof DECISION];

/** Ordered by severity so we can take the most restrictive decision. */
export const DECISION_SEVERITY: Record<Decision, number> = {
  ALLOW: 0,
  ALLOW_WITH_LIMIT: 1,
  REQUIRE_EDIT: 2,
  REQUIRE_APPROVAL: 3,
  ESCALATE_LEGAL_REVIEW: 4,
  BLOCK: 5,
};

/** Risk model (VII). */
export const RISK = {
  READ_ONLY: 0,
  DRAFT_ONLY: 1,
  REVERSIBLE_INTERNAL: 2,
  EXTERNAL_PUBLIC: 3,
  FINANCIAL_OR_LEGAL: 4,
  PROHIBITED: 5,
} as const;

export const RISK_LABEL: Record<number, string> = {
  0: 'READ_ONLY',
  1: 'DRAFT_ONLY',
  2: 'REVERSIBLE_INTERNAL_ACTION',
  3: 'EXTERNAL_PUBLIC_ACTION',
  4: 'FINANCIAL_OR_LEGAL_ACTION',
  5: 'PROHIBITED_AUTOMATION',
};

/** Canonical action types the gateway understands. Extendable via policy, not code. */
export const ACTION = {
  // read-only / draft
  GENERATE_INSIGHT: 'generate_insight',
  GENERATE_CONTENT_DRAFT: 'generate_content_draft',
  // reversible internal
  TAG: 'tag',
  UPDATE_NOTE: 'update_note',
  SCHEDULE_INTERNAL: 'schedule_internal',
  // external public (RISK 3)
  PUBLISH_CONTENT: 'publish_content',
  SEND_MARKETING: 'send_marketing',
  PUBLIC_REPLY: 'public_reply',
  LAUNCH_CAMPAIGN: 'launch_campaign',
  SYNC_MARKETPLACE: 'sync_marketplace',
  PUSH_PRODUCT: 'push_product', // create/update a marketplace listing (external write)
  // financial / legal (RISK 4)
  CHANGE_PRICE: 'change_price',
  APPLY_DISCOUNT: 'apply_discount',
  CREATE_HIGH_VALUE_ORDER: 'create_high_value_order',
  CANCEL_ORDER: 'cancel_order',
  REFUND: 'refund',
  CHANGE_SELL_TERMS: 'change_sell_terms',
  LAUNCH_PAID_AD: 'launch_paid_ad',
  // prohibited (RISK 5)
  CAPTCHA_BYPASS: 'captcha_bypass',
  SCRAPE_PROHIBITED: 'scrape_prohibited',
  FAKE_REVIEW: 'fake_review',
  IMPERSONATION: 'impersonation',
  REMOVE_WATERMARK: 'remove_watermark',
  RATE_LIMIT_EVASION: 'rate_limit_evasion',
  SELF_ELEVATE_PERMISSION: 'self_elevate_permission',
  EDIT_AUDIT_LOG: 'edit_audit_log',
} as const;

/** Base risk level per action (deterministic; policy can escalate, never silently lower). */
export const ACTION_BASE_RISK: Record<string, number> = {
  [ACTION.GENERATE_INSIGHT]: RISK.READ_ONLY,
  [ACTION.GENERATE_CONTENT_DRAFT]: RISK.DRAFT_ONLY,
  [ACTION.TAG]: RISK.REVERSIBLE_INTERNAL,
  [ACTION.UPDATE_NOTE]: RISK.REVERSIBLE_INTERNAL,
  [ACTION.SCHEDULE_INTERNAL]: RISK.REVERSIBLE_INTERNAL,
  [ACTION.PUBLISH_CONTENT]: RISK.EXTERNAL_PUBLIC,
  [ACTION.SEND_MARKETING]: RISK.EXTERNAL_PUBLIC,
  [ACTION.PUBLIC_REPLY]: RISK.EXTERNAL_PUBLIC,
  [ACTION.LAUNCH_CAMPAIGN]: RISK.EXTERNAL_PUBLIC,
  [ACTION.SYNC_MARKETPLACE]: RISK.EXTERNAL_PUBLIC,
  [ACTION.PUSH_PRODUCT]: RISK.EXTERNAL_PUBLIC,
  [ACTION.CHANGE_PRICE]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.APPLY_DISCOUNT]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.CREATE_HIGH_VALUE_ORDER]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.CANCEL_ORDER]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.REFUND]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.CHANGE_SELL_TERMS]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.LAUNCH_PAID_AD]: RISK.FINANCIAL_OR_LEGAL,
  [ACTION.CAPTCHA_BYPASS]: RISK.PROHIBITED,
  [ACTION.SCRAPE_PROHIBITED]: RISK.PROHIBITED,
  [ACTION.FAKE_REVIEW]: RISK.PROHIBITED,
  [ACTION.IMPERSONATION]: RISK.PROHIBITED,
  [ACTION.REMOVE_WATERMARK]: RISK.PROHIBITED,
  [ACTION.RATE_LIMIT_EVASION]: RISK.PROHIBITED,
  [ACTION.SELF_ELEVATE_PERMISSION]: RISK.PROHIBITED,
  [ACTION.EDIT_AUDIT_LOG]: RISK.PROHIBITED,
};

/** Actions that always require a human approval floor regardless of policy config. */
export const FINANCIAL_ACTIONS = new Set<string>([
  ACTION.CHANGE_PRICE,
  ACTION.APPLY_DISCOUNT,
  ACTION.CREATE_HIGH_VALUE_ORDER,
  ACTION.CANCEL_ORDER,
  ACTION.REFUND,
  ACTION.CHANGE_SELL_TERMS,
  ACTION.LAUNCH_PAID_AD,
]);

export const EXTERNAL_ACTIONS = new Set<string>([
  ACTION.PUBLISH_CONTENT,
  ACTION.SEND_MARKETING,
  ACTION.PUBLIC_REPLY,
  ACTION.LAUNCH_CAMPAIGN,
  ACTION.SYNC_MARKETPLACE,
  ACTION.PUSH_PRODUCT,
  ...FINANCIAL_ACTIONS,
]);

export const MARKETING_ACTIONS = new Set<string>([ACTION.SEND_MARKETING, ACTION.LAUNCH_CAMPAIGN]);

/** Kill-switch scopes (XX). */
export const KILL_SWITCH_SCOPE = {
  ALL_EXTERNAL: 'ALL_EXTERNAL',
  AUTO_PUBLISH: 'AUTO_PUBLISH',
  AD_LAUNCH: 'AD_LAUNCH',
  OUTBOUND_MARKETING: 'OUTBOUND_MARKETING',
  PLATFORM: 'PLATFORM',
  AGENT: 'AGENT',
  RISKY_CATEGORY: 'RISKY_CATEGORY',
  FINANCIAL: 'FINANCIAL',
  DATA_COLLECTION: 'DATA_COLLECTION',
} as const;

/** Absolute / prohibited marketing claims (XI) — deterministic keyword layer. */
export const ABSOLUTE_CLAIM_TERMS: string[] = [
  'tốt nhất',
  'số một',
  'số 1',
  'duy nhất',
  'rẻ nhất',
  'tuyệt đối an toàn',
  'cam kết khỏi',
  'chữa khỏi',
  'bảo đảm có lãi',
  'đảm bảo có lãi',
  'hiệu quả 100%',
  'kết quả chắc chắn',
  'không có rủi ro',
  'khỏi 100%',
  'best',
  'number one',
  'guaranteed profit',
  '100% effective',
];

/** Terms that indicate fabricated social proof / dark patterns (XI). */
export const PROHIBITED_CONTENT_TERMS: string[] = [
  'review giả',
  'đánh giá giả',
  'testimonial giả',
  'fake review',
];

export const PROPOSAL_STATUS = {
  PROPOSED: 'PROPOSED',
  EVALUATING: 'EVALUATING',
  ALLOWED: 'ALLOWED',
  EDIT_REQUIRED: 'EDIT_REQUIRED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  BLOCKED: 'BLOCKED',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

/** How long a policy decision is valid before it must be re-evaluated (ms). */
export const DECISION_TTL_MS = 15 * 60 * 1000;
/** Approval request validity window (ms). */
export const APPROVAL_TTL_MS = 24 * 3600 * 1000;
