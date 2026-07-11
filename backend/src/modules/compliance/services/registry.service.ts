import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RuleEvaluatorService } from '../engine/rule-evaluator.service';

/**
 * CRUD + queries for the compliance supporting entities used by the Compliance
 * Center UI and the guard (rules, evidence, consent, asset rights, product
 * compliance, platform packs, incidents, agent permission profiles).
 * All tenant-scoped. Status updates are additive; nothing is hard-deleted.
 */
@Injectable()
export class RegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: RuleEvaluatorService,
  ) {}

  private async page<T>(model: any, where: any, limit: number, skip: number, orderBy: any = { createdAt: 'desc' }) {
    const [rows, total] = await this.prisma.$transaction([
      model.findMany({ where, orderBy, take: limit, skip }),
      model.count({ where }),
    ]);
    return { rows, total } as { rows: T[]; total: number };
  }

  // ---- Rules ----
  createRule(tenantId: string, dto: any) {
    return this.prisma.complianceRule.create({
      data: {
        tenantId,
        policyId: dto.policyId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        ruleType: dto.ruleType,
        conditionDefinition: dto.conditionDefinition,
        decision: dto.decision,
        severity: dto.severity ?? 'MEDIUM',
        riskWeight: dto.riskWeight ?? 10,
        applicableActions: dto.applicableActions ?? undefined,
        applicableAgents: dto.applicableAgents ?? undefined,
        applicablePlatforms: dto.applicablePlatforms ?? undefined,
        applicableProductCategories: dto.applicableProductCategories ?? undefined,
        requiresEvidence: dto.requiresEvidence ?? false,
        evidenceTypes: dto.evidenceTypes ?? undefined,
        remediationInstruction: dto.remediationInstruction ?? null,
        enabled: dto.enabled ?? true,
        testCases: dto.testCases ?? undefined,
      },
    });
  }

  listRules(tenantId: string, limit: number, skip: number, policyId?: string) {
    const where: any = { tenantId };
    if (policyId) where.policyId = policyId;
    return this.page(this.prisma.complianceRule, where, limit, skip);
  }

  /** Simulate a rule condition against a sample context (XVIII.3, no code execution). */
  simulateRule(condition: any, sampleContext: any) {
    const matched = this.evaluator.evaluate(condition, sampleContext);
    return { matched };
  }

  // ---- Agent permission profiles ----
  upsertAgentProfile(tenantId: string, dto: any) {
    return this.prisma.agentPermissionProfile.create({
      data: {
        tenantId,
        agentType: dto.agentType,
        allowedActions: dto.allowedActions ?? undefined,
        approvalRequiredActions: dto.approvalRequiredActions ?? undefined,
        deniedActions: dto.deniedActions ?? undefined,
        allowedPlatforms: dto.allowedPlatforms ?? undefined,
        maximumRiskLevel: dto.maximumRiskLevel ?? 1,
        maximumDiscountPercent: dto.maximumDiscountPercent ?? 0,
        maximumOrderValue: dto.maximumOrderValue ?? 0,
        maximumAdBudget: dto.maximumAdBudget ?? 0,
        maximumMessageBatch: dto.maximumMessageBatch ?? 0,
        autoPublishAllowed: dto.autoPublishAllowed ?? false,
        active: true,
        version: dto.version ?? 1,
        effectiveFrom: new Date(),
      },
    });
  }

  listAgentProfiles(tenantId: string) {
    return this.prisma.agentPermissionProfile.findMany({ where: { tenantId, active: true }, orderBy: { agentType: 'asc' } });
  }

  // ---- Evidence ----
  createEvidence(tenantId: string, dto: any) {
    return this.prisma.evidenceRecord.create({
      data: {
        tenantId,
        evidenceType: dto.evidenceType,
        referenceType: dto.referenceType ?? null,
        referenceId: dto.referenceId ?? null,
        title: dto.title,
        source: dto.source ?? null,
        fileId: dto.fileId ?? null,
        issuer: dto.issuer ?? null,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        verificationStatus: dto.verificationStatus ?? 'PENDING',
      },
    });
  }

  async verifyEvidence(tenantId: string, id: string, verifiedBy: string, status: string) {
    const rec = await this.prisma.evidenceRecord.findFirst({ where: { id, tenantId } });
    if (!rec) throw new NotFoundException('Evidence not found');
    return this.prisma.evidenceRecord.update({
      where: { id },
      data: { verificationStatus: status, verifiedBy, verifiedAt: new Date() },
    });
  }

  listEvidence(tenantId: string, limit: number, skip: number) {
    return this.page(this.prisma.evidenceRecord, { tenantId }, limit, skip);
  }

  // ---- Consent ----
  captureConsent(tenantId: string, dto: any) {
    return this.prisma.consentRecord.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        channel: dto.channel,
        purpose: dto.purpose,
        status: dto.status ?? 'GRANTED',
        source: dto.source ?? null,
        capturedAt: new Date(),
        proofReference: dto.proofReference ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async withdrawConsent(tenantId: string, id: string) {
    const rec = await this.prisma.consentRecord.findFirst({ where: { id, tenantId } });
    if (!rec) throw new NotFoundException('Consent not found');
    return this.prisma.consentRecord.update({ where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
  }

  listConsent(tenantId: string, limit: number, skip: number, customerId?: string) {
    const where: any = { tenantId };
    if (customerId) where.customerId = customerId;
    return this.page(this.prisma.consentRecord, where, limit, skip);
  }

  // ---- Asset rights ----
  createAsset(tenantId: string, dto: any) {
    return this.prisma.assetRightsRecord.create({
      data: {
        tenantId,
        assetId: dto.assetId,
        owner: dto.owner ?? null,
        source: dto.source ?? null,
        licenseType: dto.licenseType ?? null,
        commercialUseAllowed: dto.commercialUseAllowed ?? false,
        modificationAllowed: dto.modificationAllowed ?? false,
        paidAdsAllowed: dto.paidAdsAllowed ?? false,
        allowedPlatforms: dto.allowedPlatforms ?? undefined,
        attributionRequired: dto.attributionRequired ?? false,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        verificationStatus: dto.verificationStatus ?? 'PENDING',
      },
    });
  }

  async verifyAsset(tenantId: string, id: string, status: string) {
    const rec = await this.prisma.assetRightsRecord.findFirst({ where: { id, tenantId } });
    if (!rec) throw new NotFoundException('Asset not found');
    return this.prisma.assetRightsRecord.update({ where: { id }, data: { verificationStatus: status } });
  }

  listAssets(tenantId: string, limit: number, skip: number) {
    return this.page(this.prisma.assetRightsRecord, { tenantId }, limit, skip);
  }

  // ---- Product compliance ----
  upsertProductCompliance(tenantId: string, dto: any, reviewedBy?: string) {
    return this.prisma.productComplianceProfile.upsert({
      where: { tenantId_productId: { tenantId, productId: dto.productId } },
      create: {
        tenantId,
        productId: dto.productId,
        category: dto.category ?? null,
        complianceClass: dto.complianceClass ?? 'HUMAN_REVIEW_REQUIRED',
        sellPermission: dto.sellPermission ?? 'HUMAN_REVIEW_REQUIRED',
        advertisePermission: dto.advertisePermission ?? 'HUMAN_REVIEW_REQUIRED',
        requiredLicenses: dto.requiredLicenses ?? undefined,
        prohibitedPlatforms: dto.prohibitedPlatforms ?? undefined,
        minimumAge: dto.minimumAge ?? null,
        status: dto.status ?? 'DRAFT',
        reviewedBy: reviewedBy ?? null,
        reviewedAt: reviewedBy ? new Date() : null,
      },
      update: {
        category: dto.category,
        complianceClass: dto.complianceClass,
        sellPermission: dto.sellPermission,
        advertisePermission: dto.advertisePermission,
        requiredLicenses: dto.requiredLicenses ?? undefined,
        prohibitedPlatforms: dto.prohibitedPlatforms ?? undefined,
        minimumAge: dto.minimumAge,
        status: dto.status,
        reviewedBy: reviewedBy ?? undefined,
        reviewedAt: reviewedBy ? new Date() : undefined,
      },
    });
  }

  listProductCompliance(tenantId: string, limit: number, skip: number) {
    return this.page(this.prisma.productComplianceProfile, { tenantId }, limit, skip);
  }

  // ---- Platform policy packs ----
  createPlatformPack(tenantId: string, dto: any) {
    return this.prisma.platformPolicyPack.create({
      data: {
        tenantId,
        platform: dto.platform,
        version: dto.version ?? 1,
        status: dto.status ?? 'DRAFT',
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        reviewDueAt: dto.reviewDueAt ? new Date(dto.reviewDueAt) : null,
        sourceReference: dto.sourceReference ?? null,
        officialSource: dto.officialSource ?? null,
        supportedActions: dto.supportedActions ?? undefined,
        prohibitedActions: dto.prohibitedActions ?? undefined,
        restrictedCategories: dto.restrictedCategories ?? undefined,
        automationLimits: dto.automationLimits ?? undefined,
      },
    });
  }

  async setPlatformPackStatus(tenantId: string, id: string, status: string, verifiedBy?: string) {
    const rec = await this.prisma.platformPolicyPack.findFirst({ where: { id, tenantId } });
    if (!rec) throw new NotFoundException('Platform pack not found');
    return this.prisma.platformPolicyPack.update({
      where: { id },
      data: { status, lastVerifiedAt: status === 'ACTIVE' ? new Date() : rec.lastVerifiedAt, verifiedBy: verifiedBy ?? rec.verifiedBy },
    });
  }

  listPlatformPacks(tenantId: string) {
    return this.prisma.platformPolicyPack.findMany({ where: { tenantId }, orderBy: [{ platform: 'asc' }, { version: 'desc' }] });
  }

  // ---- Incidents ----
  listIncidents(tenantId: string, limit: number, skip: number) {
    return this.page(this.prisma.complianceIncident, { tenantId }, limit, skip, { detectedAt: 'desc' });
  }

  async updateIncident(tenantId: string, id: string, dto: any) {
    const rec = await this.prisma.complianceIncident.findFirst({ where: { id, tenantId } });
    if (!rec) throw new NotFoundException('Incident not found');
    return this.prisma.complianceIncident.update({
      where: { id },
      data: {
        status: dto.status ?? rec.status,
        owner: dto.owner ?? rec.owner,
        rootCause: dto.rootCause ?? rec.rootCause,
        correctiveAction: dto.correctiveAction ?? rec.correctiveAction,
        containmentAction: dto.containmentAction ?? rec.containmentAction,
        resolvedAt: dto.status === 'RESOLVED' || dto.status === 'CLOSED' ? new Date() : rec.resolvedAt,
      },
    });
  }
}
