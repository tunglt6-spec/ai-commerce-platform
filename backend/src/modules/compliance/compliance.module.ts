import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { RegistryController } from './registry.controller';
import { RuleEvaluatorService } from './engine/rule-evaluator.service';
import { ContentScannerService } from './engine/content-scanner.service';
import { RiskService } from './engine/risk.service';
import { PolicyGuardService } from './engine/policy-guard.service';
import { AgentPermissionService } from './services/agent-permission.service';
import { KillSwitchService } from './services/kill-switch.service';
import { ComplianceAuditService } from './services/compliance-audit.service';
import { ApprovalService } from './services/approval.service';
import { ExecutionGatewayService } from './services/execution-gateway.service';
import { ComplianceService } from './services/compliance.service';
import { RegistryService } from './services/registry.service';

/**
 * AI Governance & Compliance module. Enforces the Policy Guard + Execution
 * Gateway at runtime. Exports the guard/gateway so other modules can route
 * side-effecting agent actions through the compliance boundary.
 */
@Module({
  controllers: [ComplianceController, RegistryController],
  providers: [
    RuleEvaluatorService,
    ContentScannerService,
    RiskService,
    PolicyGuardService,
    AgentPermissionService,
    KillSwitchService,
    ComplianceAuditService,
    ApprovalService,
    ExecutionGatewayService,
    ComplianceService,
    RegistryService,
  ],
  exports: [PolicyGuardService, ExecutionGatewayService, ComplianceService, AgentPermissionService],
})
export class ComplianceModule {}
