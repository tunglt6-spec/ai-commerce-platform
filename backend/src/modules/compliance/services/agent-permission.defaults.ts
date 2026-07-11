import { ACTION, RISK } from '../compliance.constants';

export interface AgentPermissionDefault {
  agentType: string;
  maximumRiskLevel: number;
  allowedActions: string[];
  approvalRequiredActions: string[];
  deniedActions: string[];
  autoPublishAllowed: boolean;
  maximumDiscountPercent: number;
  maximumOrderValue: number;
  maximumAdBudget: number;
  maximumMessageBatch: number;
}

/**
 * Least-privilege defaults (XIV). Used fail-closed when no DB profile exists for
 * an agent, so the platform is safe before any seeding. DB profiles override.
 */
export const AGENT_PERMISSION_DEFAULTS: Record<string, AgentPermissionDefault> = {
  trend_hunter_ai: {
    agentType: 'trend_hunter_ai',
    maximumRiskLevel: RISK.READ_ONLY,
    allowedActions: [ACTION.GENERATE_INSIGHT],
    approvalRequiredActions: [],
    deniedActions: [ACTION.CAPTCHA_BYPASS, ACTION.SCRAPE_PROHIBITED, ACTION.RATE_LIMIT_EVASION],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
  product_ai: {
    agentType: 'product_ai',
    maximumRiskLevel: RISK.REVERSIBLE_INTERNAL,
    allowedActions: [ACTION.GENERATE_INSIGHT, ACTION.UPDATE_NOTE, ACTION.TAG],
    approvalRequiredActions: [ACTION.CHANGE_PRICE, ACTION.APPLY_DISCOUNT, ACTION.CHANGE_SELL_TERMS],
    deniedActions: [],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
  content_ai: {
    agentType: 'content_ai',
    maximumRiskLevel: RISK.DRAFT_ONLY,
    allowedActions: [ACTION.GENERATE_CONTENT_DRAFT],
    approvalRequiredActions: [ACTION.PUBLISH_CONTENT],
    deniedActions: [ACTION.FAKE_REVIEW, ACTION.IMPERSONATION, ACTION.REMOVE_WATERMARK],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
  video_ai: {
    agentType: 'video_ai',
    maximumRiskLevel: RISK.DRAFT_ONLY,
    allowedActions: [ACTION.GENERATE_CONTENT_DRAFT],
    approvalRequiredActions: [ACTION.PUBLISH_CONTENT, ACTION.LAUNCH_PAID_AD],
    deniedActions: [ACTION.REMOVE_WATERMARK, ACTION.IMPERSONATION],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
  sales_ai: {
    agentType: 'sales_ai',
    maximumRiskLevel: RISK.REVERSIBLE_INTERNAL,
    allowedActions: [ACTION.GENERATE_INSIGHT, ACTION.UPDATE_NOTE, ACTION.PUBLIC_REPLY],
    approvalRequiredActions: [ACTION.APPLY_DISCOUNT, ACTION.CREATE_HIGH_VALUE_ORDER, ACTION.CHANGE_SELL_TERMS],
    deniedActions: [ACTION.REFUND, ACTION.FAKE_REVIEW],
    autoPublishAllowed: false,
    maximumDiscountPercent: 5,
    maximumOrderValue: 2_000_000,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
  fulfillment_ai: {
    agentType: 'fulfillment_ai',
    maximumRiskLevel: RISK.REVERSIBLE_INTERNAL,
    allowedActions: [ACTION.GENERATE_INSIGHT, ACTION.UPDATE_NOTE, ACTION.TAG],
    approvalRequiredActions: [ACTION.CANCEL_ORDER, ACTION.REFUND],
    deniedActions: [],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
  raving_fan_ai: {
    agentType: 'raving_fan_ai',
    maximumRiskLevel: RISK.DRAFT_ONLY,
    allowedActions: [ACTION.GENERATE_CONTENT_DRAFT],
    approvalRequiredActions: [ACTION.SEND_MARKETING, ACTION.LAUNCH_CAMPAIGN],
    deniedActions: [ACTION.FAKE_REVIEW],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 500,
  },
  analyze_ai: {
    agentType: 'analyze_ai',
    maximumRiskLevel: RISK.READ_ONLY,
    allowedActions: [ACTION.GENERATE_INSIGHT],
    approvalRequiredActions: [ACTION.CHANGE_PRICE, ACTION.LAUNCH_PAID_AD],
    deniedActions: [ACTION.EDIT_AUDIT_LOG, ACTION.SELF_ELEVATE_PERMISSION],
    autoPublishAllowed: false,
    maximumDiscountPercent: 0,
    maximumOrderValue: 0,
    maximumAdBudget: 0,
    maximumMessageBatch: 0,
  },
};

/** Fallback for an unknown agent: read-only, everything else denied (fail-closed). */
export const UNKNOWN_AGENT_DEFAULT: AgentPermissionDefault = {
  agentType: 'unknown',
  maximumRiskLevel: RISK.READ_ONLY,
  allowedActions: [ACTION.GENERATE_INSIGHT],
  approvalRequiredActions: [],
  deniedActions: [],
  autoPublishAllowed: false,
  maximumDiscountPercent: 0,
  maximumOrderValue: 0,
  maximumAdBudget: 0,
  maximumMessageBatch: 0,
};
