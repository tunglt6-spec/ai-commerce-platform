-- CreateTable
CREATE TABLE "compliance_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "policy_type" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "platform" TEXT,
    "product_category" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "review_due_at" TIMESTAMP(3),
    "source_reference" TEXT,
    "source_type" TEXT,
    "source_verified_at" TIMESTAMP(3),
    "owner_user_id" UUID,
    "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
    "enforcement_mode" TEXT NOT NULL DEFAULT 'ADVISORY',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "legal_review_state" TEXT NOT NULL DEFAULT 'NEEDS_LEGAL_REVIEW',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule_type" TEXT NOT NULL,
    "condition_definition" JSONB NOT NULL,
    "decision" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "risk_weight" INTEGER NOT NULL DEFAULT 10,
    "applicable_actions" JSONB,
    "applicable_agents" JSONB,
    "applicable_platforms" JSONB,
    "applicable_product_categories" JSONB,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT false,
    "evidence_types" JSONB,
    "remediation_instruction" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "test_cases" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_permission_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_type" TEXT NOT NULL,
    "allowed_tools" JSONB,
    "allowed_actions" JSONB,
    "denied_actions" JSONB,
    "allowed_platforms" JSONB,
    "maximum_risk_level" INTEGER NOT NULL DEFAULT 1,
    "maximum_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "maximum_order_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maximum_ad_budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maximum_message_batch" INTEGER NOT NULL DEFAULT 0,
    "auto_publish_allowed" BOOLEAN NOT NULL DEFAULT false,
    "approval_required_actions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_permission_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_action_proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "actor_user_id" UUID,
    "action_type" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "platform" TEXT,
    "product_category" TEXT,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risk_level" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "policy_decision_id" UUID,
    "approval_request_id" UUID,
    "idempotency_key" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_action_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_decision_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_level" INTEGER NOT NULL,
    "matched_rules" JSONB,
    "failed_rules" JSONB,
    "warnings" JSONB,
    "required_edits" JSONB,
    "required_evidence" JSONB,
    "limits" JSONB,
    "policy_snapshot" JSONB,
    "policy_version_set" JSONB,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluator_version" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,

    CONSTRAINT "policy_decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_approval_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "approval_type" TEXT NOT NULL,
    "requested_by" UUID,
    "assigned_role" TEXT,
    "assigned_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "policy_decision_snapshot" JSONB,
    "approved_payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "file_id" TEXT,
    "issuer" TEXT,
    "issued_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "source" TEXT,
    "captured_at" TIMESTAMP(3),
    "proof_reference" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_rights_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" TEXT NOT NULL,
    "owner" TEXT,
    "source" TEXT,
    "license_type" TEXT,
    "commercial_use_allowed" BOOLEAN NOT NULL DEFAULT false,
    "modification_allowed" BOOLEAN NOT NULL DEFAULT false,
    "paid_ads_allowed" BOOLEAN NOT NULL DEFAULT false,
    "allowed_platforms" JSONB,
    "attribution_required" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "proof_reference" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_rights_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_compliance_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "category" TEXT,
    "compliance_class" TEXT NOT NULL DEFAULT 'HUMAN_REVIEW_REQUIRED',
    "sell_permission" TEXT NOT NULL DEFAULT 'HUMAN_REVIEW_REQUIRED',
    "advertise_permission" TEXT NOT NULL DEFAULT 'HUMAN_REVIEW_REQUIRED',
    "required_licenses" JSONB,
    "prohibited_platforms" JSONB,
    "restricted_audience" JSONB,
    "minimum_age" INTEGER,
    "warning_requirements" JSONB,
    "claims_restrictions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_compliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_policy_packs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMP(3),
    "review_due_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source_reference" TEXT,
    "official_source" TEXT,
    "supported_actions" JSONB,
    "prohibited_actions" JSONB,
    "restricted_categories" JSONB,
    "content_requirements" JSONB,
    "automation_limits" JSONB,
    "rate_limit_policy" JSONB,
    "disclosure_requirements" JSONB,
    "last_verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_policy_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source_registry" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_name" TEXT NOT NULL,
    "owner" TEXT,
    "access_method" TEXT,
    "official_api_status" BOOLEAN NOT NULL DEFAULT false,
    "terms_reference" TEXT,
    "collection_purpose" TEXT,
    "permitted_fields" JSONB,
    "prohibited_fields" JSONB,
    "legal_basis" TEXT,
    "consent_requirement" BOOLEAN NOT NULL DEFAULT false,
    "retention" TEXT,
    "ai_processing_allowed" BOOLEAN NOT NULL DEFAULT false,
    "redistribution_allowed" BOOLEAN NOT NULL DEFAULT false,
    "last_reviewed_at" TIMESTAMP(3),
    "risk_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_incidents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID,
    "agent_id" TEXT,
    "incident_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "affected_platform" TEXT,
    "affected_records" JSONB,
    "containment_action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "owner" UUID,
    "resolved_at" TIMESTAMP(3),
    "root_cause" TEXT,
    "corrective_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_kill_switches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "scope_value" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "activated_by" UUID,
    "effective_from" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_kill_switches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_execution_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "platform" TEXT,
    "external_reference" TEXT,
    "result" TEXT NOT NULL,
    "response_redacted" JSONB,
    "correlation_id" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_execution_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immutable_compliance_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "agent_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "before_hash" TEXT,
    "after_hash" TEXT,
    "policy_decision_id" UUID,
    "approval_id" UUID,
    "result" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT,
    "metadata" JSONB,

    CONSTRAINT "immutable_compliance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_policies_tenant_id_idx" ON "compliance_policies"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_policies_tenant_id_status_idx" ON "compliance_policies"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "compliance_policies_tenant_id_policy_type_idx" ON "compliance_policies"("tenant_id", "policy_type");

-- CreateIndex
CREATE INDEX "compliance_policies_review_due_at_idx" ON "compliance_policies"("review_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_policies_tenant_id_code_version_key" ON "compliance_policies"("tenant_id", "code", "version");

-- CreateIndex
CREATE INDEX "compliance_rules_tenant_id_idx" ON "compliance_rules"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_rules_policy_id_idx" ON "compliance_rules"("policy_id");

-- CreateIndex
CREATE INDEX "compliance_rules_tenant_id_rule_type_enabled_idx" ON "compliance_rules"("tenant_id", "rule_type", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rules_tenant_id_code_key" ON "compliance_rules"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "agent_permission_profiles_tenant_id_idx" ON "agent_permission_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_permission_profiles_tenant_id_agent_type_active_idx" ON "agent_permission_profiles"("tenant_id", "agent_type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "agent_permission_profiles_tenant_id_agent_type_version_key" ON "agent_permission_profiles"("tenant_id", "agent_type", "version");

-- CreateIndex
CREATE INDEX "agent_action_proposals_tenant_id_idx" ON "agent_action_proposals"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_action_proposals_tenant_id_status_idx" ON "agent_action_proposals"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "agent_action_proposals_tenant_id_agent_id_idx" ON "agent_action_proposals"("tenant_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_action_proposals_tenant_id_idempotency_key_key" ON "agent_action_proposals"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "policy_decision_records_tenant_id_idx" ON "policy_decision_records"("tenant_id");

-- CreateIndex
CREATE INDEX "policy_decision_records_proposal_id_idx" ON "policy_decision_records"("proposal_id");

-- CreateIndex
CREATE INDEX "policy_decision_records_correlation_id_idx" ON "policy_decision_records"("correlation_id");

-- CreateIndex
CREATE INDEX "compliance_approval_requests_tenant_id_idx" ON "compliance_approval_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_approval_requests_tenant_id_status_idx" ON "compliance_approval_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "compliance_approval_requests_proposal_id_idx" ON "compliance_approval_requests"("proposal_id");

-- CreateIndex
CREATE INDEX "evidence_records_tenant_id_idx" ON "evidence_records"("tenant_id");

-- CreateIndex
CREATE INDEX "evidence_records_tenant_id_evidence_type_idx" ON "evidence_records"("tenant_id", "evidence_type");

-- CreateIndex
CREATE INDEX "evidence_records_valid_until_idx" ON "evidence_records"("valid_until");

-- CreateIndex
CREATE INDEX "consent_records_tenant_id_idx" ON "consent_records"("tenant_id");

-- CreateIndex
CREATE INDEX "consent_records_tenant_id_customer_id_channel_purpose_idx" ON "consent_records"("tenant_id", "customer_id", "channel", "purpose");

-- CreateIndex
CREATE INDEX "asset_rights_records_tenant_id_idx" ON "asset_rights_records"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_rights_records_tenant_id_asset_id_idx" ON "asset_rights_records"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "asset_rights_records_valid_until_idx" ON "asset_rights_records"("valid_until");

-- CreateIndex
CREATE INDEX "product_compliance_profiles_tenant_id_idx" ON "product_compliance_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "product_compliance_profiles_tenant_id_compliance_class_idx" ON "product_compliance_profiles"("tenant_id", "compliance_class");

-- CreateIndex
CREATE UNIQUE INDEX "product_compliance_profiles_tenant_id_product_id_key" ON "product_compliance_profiles"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "platform_policy_packs_tenant_id_idx" ON "platform_policy_packs"("tenant_id");

-- CreateIndex
CREATE INDEX "platform_policy_packs_tenant_id_platform_status_idx" ON "platform_policy_packs"("tenant_id", "platform", "status");

-- CreateIndex
CREATE INDEX "platform_policy_packs_review_due_at_idx" ON "platform_policy_packs"("review_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_policy_packs_tenant_id_platform_version_key" ON "platform_policy_packs"("tenant_id", "platform", "version");

-- CreateIndex
CREATE INDEX "data_source_registry_tenant_id_idx" ON "data_source_registry"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_registry_tenant_id_source_name_key" ON "data_source_registry"("tenant_id", "source_name");

-- CreateIndex
CREATE INDEX "compliance_incidents_tenant_id_idx" ON "compliance_incidents"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_incidents_tenant_id_severity_status_idx" ON "compliance_incidents"("tenant_id", "severity", "status");

-- CreateIndex
CREATE INDEX "compliance_kill_switches_tenant_id_idx" ON "compliance_kill_switches"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_kill_switches_tenant_id_scope_active_idx" ON "compliance_kill_switches"("tenant_id", "scope", "active");

-- CreateIndex
CREATE INDEX "compliance_execution_receipts_tenant_id_idx" ON "compliance_execution_receipts"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_execution_receipts_proposal_id_idx" ON "compliance_execution_receipts"("proposal_id");

-- CreateIndex
CREATE INDEX "immutable_compliance_audit_logs_tenant_id_idx" ON "immutable_compliance_audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "immutable_compliance_audit_logs_tenant_id_timestamp_idx" ON "immutable_compliance_audit_logs"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "immutable_compliance_audit_logs_correlation_id_idx" ON "immutable_compliance_audit_logs"("correlation_id");

-- AddForeignKey
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "compliance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

