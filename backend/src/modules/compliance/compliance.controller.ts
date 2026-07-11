import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { paginate } from '../../common/dto/pagination.dto';
import { ComplianceService } from './services/compliance.service';
import { RegistryService } from './services/registry.service';
import { ApprovalService } from './services/approval.service';
import { ExecutionGatewayService } from './services/execution-gateway.service';
import { ComplianceAuditService } from './services/compliance-audit.service';
import { AgentPermissionService } from './services/agent-permission.service';
import { AGENT_PERMISSION_DEFAULTS } from './services/agent-permission.defaults';
import {
  AgentProfileDto,
  ComplianceQueryDto,
  CreatePolicyDto,
  CreateRuleDto,
  DecideApprovalDto,
  ProposeActionDto,
  SetKillSwitchDto,
  SetPolicyStatusDto,
  SimulateRuleDto,
} from './dto/compliance.dto';

@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly registry: RegistryService,
    private readonly approval: ApprovalService,
    private readonly gateway: ExecutionGatewayService,
    private readonly audit: ComplianceAuditService,
    private readonly perms: AgentPermissionService,
  ) {}

  // ---------------- Proposals + Execution Gateway ----------------

  @Post('proposals')
  @Roles(ROLES.OPERATOR)
  async propose(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProposeActionDto) {
    const data = await this.compliance.propose(user.tenantId, { userId: user.userId }, dto);
    return { success: true, data };
  }

  @Get('proposals')
  async listProposals(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.compliance.listProposals(tenantId, { limit: q.limit, skip: q.skip, status: q.status });
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Get('proposals/:id')
  async getProposal(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.compliance.getProposal(tenantId, id);
    return { success: true, data };
  }

  @Post('proposals/:id/execute')
  @Roles(ROLES.OPERATOR)
  async execute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.gateway.execute(user.tenantId, id, { userId: user.userId, role: user.role });
    return { success: true, data };
  }

  // ---------------- Approvals ----------------

  @Get('approvals')
  async pending(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.approval.listPending(tenantId, q.limit, q.skip);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Patch('approvals/:id')
  @Roles(ROLES.MANAGER)
  async decide(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DecideApprovalDto) {
    const data = await this.approval.decide(user.tenantId, id, { userId: user.userId, role: user.role }, dto.approved, dto.note);
    return { success: true, data };
  }

  // ---------------- Policies + versioning ----------------

  @Post('policies')
  @Roles(ROLES.MANAGER)
  async createPolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePolicyDto) {
    const data = await this.compliance.createPolicy(user.tenantId, dto, user.userId);
    return { success: true, data };
  }

  @Get('policies')
  async listPolicies(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.compliance.listPolicies(tenantId, { limit: q.limit, skip: q.skip, status: q.status, policyType: q.policyType });
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Get('policies/:id')
  async getPolicy(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.compliance.getPolicy(tenantId, id);
    return { success: true, data };
  }

  @Post('policies/:id/version')
  @Roles(ROLES.MANAGER)
  async newVersion(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.compliance.newVersion(tenantId, id);
    return { success: true, data };
  }

  @Patch('policies/:id/status')
  @Roles(ROLES.MANAGER)
  async setPolicyStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetPolicyStatusDto) {
    const data = await this.compliance.setPolicyStatus(user.tenantId, id, dto.status, { userId: user.userId });
    return { success: true, data };
  }

  // ---------------- Rules ----------------

  @Post('rules')
  @Roles(ROLES.MANAGER)
  async createRule(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateRuleDto) {
    const data = await this.registry.createRule(tenantId, dto);
    return { success: true, data };
  }

  @Get('rules')
  async listRules(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.registry.listRules(tenantId, q.limit, q.skip, q.policyId);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Post('rules/simulate')
  @Roles(ROLES.MANAGER)
  async simulate(@Body() dto: SimulateRuleDto) {
    const data = this.registry.simulateRule(dto.conditionDefinition, dto.sampleContext);
    return { success: true, data };
  }

  // ---------------- Agent permission matrix ----------------

  @Get('agent-permissions')
  async agentPermissions(@CurrentUser('tenantId') tenantId: string) {
    const profiles = await this.registry.listAgentProfiles(tenantId);
    const byType = new Map(profiles.map((p) => [p.agentType, p]));
    // Merge with least-privilege defaults so the matrix is always complete.
    const data = Object.values(AGENT_PERMISSION_DEFAULTS).map((def) => {
      const dbP = byType.get(def.agentType);
      return {
        agentType: def.agentType,
        source: dbP ? 'db' : 'default',
        maximumRiskLevel: dbP?.maximumRiskLevel ?? def.maximumRiskLevel,
        allowedActions: dbP?.allowedActions ?? def.allowedActions,
        approvalRequiredActions: dbP?.approvalRequiredActions ?? def.approvalRequiredActions,
        deniedActions: dbP?.deniedActions ?? def.deniedActions,
        autoPublishAllowed: dbP?.autoPublishAllowed ?? def.autoPublishAllowed,
        maximumDiscountPercent: Number(dbP?.maximumDiscountPercent ?? def.maximumDiscountPercent),
        maximumOrderValue: Number(dbP?.maximumOrderValue ?? def.maximumOrderValue),
        maximumAdBudget: Number(dbP?.maximumAdBudget ?? def.maximumAdBudget),
        maximumMessageBatch: dbP?.maximumMessageBatch ?? def.maximumMessageBatch,
      };
    });
    return { success: true, data };
  }

  @Post('agent-permissions')
  @Roles(ROLES.ADMIN)
  async upsertAgentProfile(@CurrentUser('tenantId') tenantId: string, @Body() dto: AgentProfileDto) {
    const data = await this.registry.upsertAgentProfile(tenantId, dto);
    return { success: true, data };
  }

  // ---------------- Kill switches ----------------

  @Get('kill-switches')
  async listKillSwitches(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.compliance.listKillSwitches(tenantId);
    return { success: true, data };
  }

  @Post('kill-switches')
  @Roles(ROLES.MANAGER)
  async setKillSwitch(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetKillSwitchDto) {
    const data = await this.compliance.setKillSwitch(user.tenantId, dto, { userId: user.userId });
    return { success: true, data };
  }

  // ---------------- Dashboard + audit ----------------

  @Get('dashboard/metrics')
  async metrics(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.compliance.dashboardMetrics(tenantId);
    return { success: true, data };
  }

  @Get('audit')
  @Roles(ROLES.MANAGER)
  async auditQuery(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.audit.query(tenantId, { limit: q.limit, skip: q.skip, correlationId: q.correlationId, action: q.action });
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }
}
