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

/**
 * Whether a Prisma `where` constrains the query to EXACTLY `tenantId` — verifying the
 * VALUE, not just the presence of the key (so a user-supplied `tenantId` for another
 * tenant does not satisfy it). Recognises a scalar `tenantId` at the top level or inside
 * an AND (which further restricts). A `tenantId` nested only inside an OR is ignored — an
 * OR branch does not constrain the whole query (other branches could match other tenants),
 * so it fails closed. A non-scalar `tenantId` (operator object like {in}/{not}) is not a
 * legitimate scoping pattern here and also fails closed.
 */
export function whereScopesToTenant(where: unknown, tenantId: string, depth = 0): boolean {
  if (!where || typeof where !== 'object' || depth > 5) return false;
  const w = where as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(w, 'tenantId')) {
    return typeof w.tenantId === 'string' && w.tenantId === tenantId;
  }
  const and = w.AND;
  if (Array.isArray(and)) return and.some((sub) => whereScopesToTenant(sub, tenantId, depth + 1));
  if (and && typeof and === 'object') return whereScopesToTenant(and, tenantId, depth + 1);
  return false;
}

/**
 * Decide whether a query must be blocked (fail-closed). Blocks a tenant-scoped set-op
 * unless it is verifiably constrained to the CALLER'S tenant. Allows only:
 *  - non-tenant models,
 *  - true system context: no request store (startup/cron) OR explicit bypass
 *    (runWithoutTenantGuard), OR a platform admin,
 *  - single-record ops (findUnique/findFirst/create/… not in ENFORCED_ACTIONS).
 * An authenticated request must scope to its own tenant; an UNAUTHENTICATED request
 * (store present, tenantId null, no bypass) cannot scope at all → blocked.
 */
export function shouldBlockQuery(
  model: string | undefined,
  action: string,
  args: { where?: unknown } | undefined,
  store: TenantStore | undefined,
): boolean {
  if (!model || !TENANT_SCOPED_MODELS.has(model)) return false;
  if (!store || store.bypass || store.isPlatformAdmin) return false;
  if (!ENFORCED_ACTIONS.has(action)) return false;
  if (store.tenantId == null) return true; // authenticated context required to scope
  return !whereScopesToTenant(args?.where, store.tenantId);
}
