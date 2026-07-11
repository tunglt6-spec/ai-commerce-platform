import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { paginate } from '../../common/dto/pagination.dto';
import { RegistryService } from './services/registry.service';
import {
  CaptureConsentDto,
  ComplianceQueryDto,
  CreateAssetDto,
  CreateEvidenceDto,
  CreatePlatformPackDto,
  ProductComplianceDto,
  SetPlatformPackStatusDto,
  UpdateIncidentDto,
  VerifyDto,
} from './dto/compliance.dto';

@Controller('compliance')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  // ---- Evidence ----
  @Post('evidence')
  @Roles(ROLES.OPERATOR)
  async createEvidence(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateEvidenceDto) {
    return { success: true, data: await this.registry.createEvidence(tenantId, dto) };
  }

  @Get('evidence')
  async listEvidence(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.registry.listEvidence(tenantId, q.limit, q.skip);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Patch('evidence/:id/verify')
  @Roles(ROLES.MANAGER)
  async verifyEvidence(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VerifyDto) {
    return { success: true, data: await this.registry.verifyEvidence(user.tenantId, id, user.userId, dto.status) };
  }

  // ---- Consent ----
  @Post('consent')
  @Roles(ROLES.OPERATOR)
  async captureConsent(@CurrentUser('tenantId') tenantId: string, @Body() dto: CaptureConsentDto) {
    return { success: true, data: await this.registry.captureConsent(tenantId, dto) };
  }

  @Get('consent')
  async listConsent(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.registry.listConsent(tenantId, q.limit, q.skip, q.customerId);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Patch('consent/:id/withdraw')
  @Roles(ROLES.OPERATOR)
  async withdrawConsent(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return { success: true, data: await this.registry.withdrawConsent(tenantId, id) };
  }

  // ---- Asset rights ----
  @Post('assets')
  @Roles(ROLES.OPERATOR)
  async createAsset(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAssetDto) {
    return { success: true, data: await this.registry.createAsset(tenantId, dto) };
  }

  @Get('assets')
  async listAssets(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.registry.listAssets(tenantId, q.limit, q.skip);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Patch('assets/:id/verify')
  @Roles(ROLES.MANAGER)
  async verifyAsset(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: VerifyDto) {
    return { success: true, data: await this.registry.verifyAsset(tenantId, id, dto.status) };
  }

  // ---- Product compliance ----
  @Post('product-compliance')
  @Roles(ROLES.MANAGER)
  async upsertProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProductComplianceDto) {
    return { success: true, data: await this.registry.upsertProductCompliance(user.tenantId, dto, user.userId) };
  }

  @Get('product-compliance')
  async listProduct(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.registry.listProductCompliance(tenantId, q.limit, q.skip);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  // ---- Platform policy packs ----
  @Post('platform-packs')
  @Roles(ROLES.MANAGER)
  async createPack(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreatePlatformPackDto) {
    return { success: true, data: await this.registry.createPlatformPack(tenantId, dto) };
  }

  @Get('platform-packs')
  async listPacks(@CurrentUser('tenantId') tenantId: string) {
    return { success: true, data: await this.registry.listPlatformPacks(tenantId) };
  }

  @Patch('platform-packs/:id/status')
  @Roles(ROLES.MANAGER)
  async setPackStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetPlatformPackStatusDto) {
    return { success: true, data: await this.registry.setPlatformPackStatus(user.tenantId, id, dto.status, user.userId) };
  }

  // ---- Incidents ----
  @Get('incidents')
  async listIncidents(@CurrentUser('tenantId') tenantId: string, @Query() q: ComplianceQueryDto) {
    const { rows, total } = await this.registry.listIncidents(tenantId, q.limit, q.skip);
    return { success: true, ...paginate(rows, total, q.page, q.limit) };
  }

  @Patch('incidents/:id')
  @Roles(ROLES.MANAGER)
  async updateIncident(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return { success: true, data: await this.registry.updateIncident(tenantId, id, dto) };
  }
}
