import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ProposeActionDto {
  @IsString() agentId!: string;
  @IsString() actionType!: string;
  @IsOptional() @IsString() targetType?: string;
  @IsOptional() @IsString() targetId?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() productCategory?: string;
  @IsObject() payload!: Record<string, any>;
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class DecideApprovalDto {
  @IsBoolean() approved!: boolean;
  @IsOptional() @IsString() note?: string;
}

export class CreatePolicyDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() policyType!: string;
  @IsOptional() @IsString() jurisdiction?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() productCategory?: string;
  @IsOptional() @IsIn(['ADVISORY', 'WARN', 'REQUIRE_APPROVAL', 'BLOCK']) enforcementMode?: string;
  @IsOptional() @IsString() sourceReference?: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() reviewDueAt?: string;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() legalReviewState?: string;
  @IsOptional() @IsInt() priority?: number;
}

export class SetPolicyStatusDto {
  @IsIn(['UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'SUPERSEDED', 'ARCHIVED']) status!: string;
}

export class CreateRuleDto {
  @IsUUID() policyId!: string;
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() ruleType!: string;
  @IsObject() conditionDefinition!: Record<string, any>;
  @IsIn(['ALLOW', 'ALLOW_WITH_LIMIT', 'REQUIRE_EDIT', 'REQUIRE_APPROVAL', 'BLOCK', 'ESCALATE_LEGAL_REVIEW']) decision!: string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity?: string;
  @IsOptional() @IsInt() riskWeight?: number;
  @IsOptional() @IsArray() applicableActions?: string[];
  @IsOptional() @IsArray() applicableAgents?: string[];
  @IsOptional() @IsArray() applicablePlatforms?: string[];
  @IsOptional() @IsArray() applicableProductCategories?: string[];
  @IsOptional() @IsBoolean() requiresEvidence?: boolean;
  @IsOptional() @IsArray() evidenceTypes?: string[];
  @IsOptional() @IsString() remediationInstruction?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsArray() testCases?: any[];
}

export class SimulateRuleDto {
  @IsObject() conditionDefinition!: Record<string, any>;
  @IsObject() sampleContext!: Record<string, any>;
}

export class SetKillSwitchDto {
  @IsIn(['ALL_EXTERNAL', 'AUTO_PUBLISH', 'AD_LAUNCH', 'OUTBOUND_MARKETING', 'PLATFORM', 'AGENT', 'RISKY_CATEGORY', 'FINANCIAL', 'DATA_COLLECTION'])
  scope!: string;
  @IsOptional() @IsString() scopeValue?: string;
  @IsBoolean() active!: boolean;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() expiresAt?: string;
}

export class AgentProfileDto {
  @IsString() agentType!: string;
  @IsOptional() @IsArray() allowedActions?: string[];
  @IsOptional() @IsArray() approvalRequiredActions?: string[];
  @IsOptional() @IsArray() deniedActions?: string[];
  @IsOptional() @IsArray() allowedPlatforms?: string[];
  @IsOptional() @IsInt() @Min(0) maximumRiskLevel?: number;
  @IsOptional() @IsNumber() maximumDiscountPercent?: number;
  @IsOptional() @IsNumber() maximumOrderValue?: number;
  @IsOptional() @IsNumber() maximumAdBudget?: number;
  @IsOptional() @IsInt() maximumMessageBatch?: number;
  @IsOptional() @IsBoolean() autoPublishAllowed?: boolean;
  @IsOptional() @IsInt() version?: number;
}

export class CreateEvidenceDto {
  @IsString() evidenceType!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() fileId?: string;
  @IsOptional() @IsString() issuer?: string;
  @IsOptional() @IsString() issuedAt?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() verificationStatus?: string;
}

export class VerifyDto {
  @IsIn(['VERIFIED', 'REJECTED', 'EXPIRED', 'RESTRICTED', 'PENDING']) status!: string;
}

export class CaptureConsentDto {
  @IsUUID() customerId!: string;
  @IsString() channel!: string;
  @IsString() purpose!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() proofReference?: string;
  @IsOptional() @IsString() expiresAt?: string;
}

export class CreateAssetDto {
  @IsString() assetId!: string;
  @IsOptional() @IsString() owner?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() licenseType?: string;
  @IsOptional() @IsBoolean() commercialUseAllowed?: boolean;
  @IsOptional() @IsBoolean() modificationAllowed?: boolean;
  @IsOptional() @IsBoolean() paidAdsAllowed?: boolean;
  @IsOptional() @IsArray() allowedPlatforms?: string[];
  @IsOptional() @IsBoolean() attributionRequired?: boolean;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() verificationStatus?: string;
}

export class ProductComplianceDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['ALLOWED', 'RESTRICTED', 'LICENSE_REQUIRED', 'PLATFORM_RESTRICTED', 'HUMAN_REVIEW_REQUIRED', 'PROHIBITED']) complianceClass?: string;
  @IsOptional() @IsIn(['ALLOWED', 'DENIED', 'HUMAN_REVIEW_REQUIRED']) sellPermission?: string;
  @IsOptional() @IsIn(['ALLOWED', 'DENIED', 'HUMAN_REVIEW_REQUIRED']) advertisePermission?: string;
  @IsOptional() @IsArray() requiredLicenses?: string[];
  @IsOptional() @IsArray() prohibitedPlatforms?: string[];
  @IsOptional() @IsInt() minimumAge?: number;
  @IsOptional() @IsString() status?: string;
}

export class CreatePlatformPackDto {
  @IsString() platform!: string;
  @IsOptional() @IsInt() version?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() reviewDueAt?: string;
  @IsOptional() @IsString() sourceReference?: string;
  @IsOptional() @IsString() officialSource?: string;
  @IsOptional() @IsArray() supportedActions?: string[];
  @IsOptional() @IsArray() prohibitedActions?: string[];
  @IsOptional() @IsArray() restrictedCategories?: string[];
  @IsOptional() @IsObject() automationLimits?: Record<string, any>;
}

export class SetPlatformPackStatusDto {
  @IsIn(['DRAFT', 'ACTIVE', 'OUTDATED', 'SUSPENDED']) status!: string;
}

export class UpdateIncidentDto {
  @IsOptional() @IsIn(['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED']) status?: string;
  @IsOptional() @IsString() owner?: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() correctiveAction?: string;
  @IsOptional() @IsString() containmentAction?: string;
}

export class ComplianceQueryDto extends PaginationDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() policyType?: string;
  @IsOptional() @IsString() policyId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() correlationId?: string;
  @IsOptional() @IsString() action?: string;
  @Type(() => Number) @IsOptional() @IsInt() unused?: number;
}
