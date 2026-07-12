import { TenantStore } from '../context/tenant-context';

/**
 * Prisma models that carry a `tenant_id` column. A list/bulk query on any of these
 * MUST be scoped by tenant. Kept in sync with prisma/schema.prisma.
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  'AgentActionProposal',
  'AgentPermissionProfile',
  'AiAgentTask',
  'AssetRightsRecord',
  'AuditLog',
  'Category',
  'ComplianceApprovalRequest',
  'ComplianceExecutionReceipt',
  'ComplianceIncident',
  'ComplianceKillSwitch',
  'CompliancePolicy',
  'ComplianceRule',
  'ConsentRecord',
  'ContentAsset',
  'ContentCalendar',
  'Customer',
  'CustomerConversation',
  'DailyKpiSnapshot',
  'DataSourceRegistry',
  'EvidenceRecord',
  'FaqItem',
  'FinancialTransaction',
  'ImmutableComplianceAuditLog',
  'Integration',
  'Order',
  'PlatformPolicyPack',
  'PolicyDecisionRecord',
  'Product',
  'ProductComplianceProfile',
  'PromptTemplate',
  'WorkflowExecution',
  // Note: RefreshToken and UserTenant also carry tenant_id but are read during the
  // auth flow (no tenant context yet) by unique keys, so they are intentionally
  // NOT enforced here to avoid breaking authentication.
]);

/**
 * Set-operating actions where a missing tenant filter risks a cross-tenant MASS leak
 * (returns/affects every tenant's rows). Single-record ops (findUnique/findFirst/create)
 * are intentionally excluded — they have many legitimate non-tenant uses and cannot leak
 * a set. The application still scopes those explicitly.
 */
const ENFORCED_ACTIONS = new Set(['findMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy']);

/** Recursively check whether a Prisma `where` constrains `tenantId` (top-level or via AND/OR). */
export function whereHasTenantScope(where: unknown, depth = 0): boolean {
  if (!where || typeof where !== 'object' || depth > 5) return false;
  const w = where as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(w, 'tenantId')) return true;
  for (const key of ['AND', 'OR'] as const) {
    const v = w[key];
    if (Array.isArray(v)) {
      if (v.some((sub) => whereHasTenantScope(sub, depth + 1))) return true;
    } else if (v && whereHasTenantScope(v, depth + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Decide whether a query must be blocked. Fail-closed for tenant-scoped list/bulk ops
 * issued inside an authenticated, non-platform-admin request that lacks a tenant filter.
 * Allows: non-tenant models, system/startup (no tenant in context), platform admins,
 * explicit bypass, and single-record ops (findUnique/create/etc. not in ENFORCED_ACTIONS).
 */
export function shouldBlockQuery(
  model: string | undefined,
  action: string,
  args: { where?: unknown } | undefined,
  store: TenantStore | undefined,
): boolean {
  if (!model || !TENANT_SCOPED_MODELS.has(model)) return false;
  if (!store || store.bypass || store.isPlatformAdmin || store.tenantId == null) return false;
  if (!ENFORCED_ACTIONS.has(action)) return false;
  return !whereHasTenantScope(args?.where);
}
