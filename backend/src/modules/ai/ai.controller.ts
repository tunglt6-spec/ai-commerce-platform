import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AiService } from './ai.service';
import { ScoringService } from './agents/scoring.service';
import { ContentAgentService } from './agents/content.service';
import { VideoAgentService } from './agents/video.service';
import {
  ApproveTaskDto,
  GenerateCaptionDto,
  GenerateDescriptionDto,
  GenerateVideoPlanDto,
  GenerateVideoScriptDto,
} from './dto/ai.dto';
import { NotFoundException } from '@nestjs/common';

@Controller('ai')
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly scoring: ScoringService,
    private readonly content: ContentAgentService,
    private readonly video: VideoAgentService,
  ) {}

  private async loadProduct(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private toContext(product: any) {
    const retail = Number(product.retailPrice);
    const cost = Number(product.costPrice);
    return {
      name: product.name,
      category: product.category?.name,
      retailPrice: retail,
      marginPercent: retail > 0 ? Math.round(((retail - cost) / retail) * 100) : 0,
      shortDescription: product.shortDescription,
    };
  }

  @Post('products/:id/score')
  @Roles(ROLES.OPERATOR)
  async scoreProduct(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const start = Date.now();
    const product = await this.loadProduct(user.tenantId, id);
    const breakdown = this.scoring.score({
      costPrice: Number(product.costPrice),
      retailPrice: Number(product.retailPrice),
      tags: Array.isArray(product.tags) ? (product.tags as string[]) : [],
      hasImages: !!product.primaryImageUrl || (product.imageUrls?.length ?? 0) > 0,
    });

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        productScore: breakdown.total_score,
        demandScore: breakdown.demand_score,
        competitionScore: breakdown.competition_score,
        profitMarginScore: breakdown.profit_margin_score,
        contentViabilityScore: breakdown.content_viability_score,
        riskScore: breakdown.risk_score,
        scoreUpdatedAt: new Date(),
      },
      select: { id: true, name: true, productScore: true },
    });

    await this.ai.logTask({
      tenantId: user.tenantId,
      agentName: 'product_ai',
      taskType: 'score_product',
      inputData: { product_id: id },
      outputData: breakdown,
      modelUsed: 'deterministic-formula',
      tokensUsed: 0,
      estimatedCost: 0,
      executionTimeMs: Date.now() - start,
      triggeredBy: 'manual',
    });

    return { success: true, data: { product: updated, breakdown } };
  }

  @Post('content/generate-description')
  @Roles(ROLES.OPERATOR)
  async generateDescription(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateDescriptionDto) {
    const start = Date.now();
    const product = await this.loadProduct(user.tenantId, dto.product_id);
    const result = await this.content.generateDescription(
      this.toContext(product),
      dto.target_platform,
      dto.variations,
    );
    await this.ai.logTask({
      tenantId: user.tenantId,
      agentName: 'content_ai',
      taskType: 'generate_description',
      inputData: { product_id: dto.product_id, platform: dto.target_platform },
      outputData: { count: result.variations.length, from_provider: result.from_provider },
      modelUsed: result.model || undefined,
      tokensUsed: result.tokens_used,
      estimatedCost: result.estimated_cost,
      status: result.provider_configured ? (result.from_provider ? 'completed' : 'failed') : 'failed',
      errorMessage: result.provider_configured ? undefined : 'AI_GATEWAY_NOT_CONFIGURED',
      executionTimeMs: Date.now() - start,
    });
    return { success: true, data: result };
  }

  @Post('content/generate-caption')
  @Roles(ROLES.OPERATOR)
  async generateCaption(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateCaptionDto) {
    const product = await this.loadProduct(user.tenantId, dto.product_id);
    const result = await this.content.generateCaption(
      this.toContext(product),
      dto.platform,
      dto.vibe,
      dto.variations,
    );
    await this.ai.logTask({
      tenantId: user.tenantId,
      agentName: 'content_ai',
      taskType: 'generate_caption',
      inputData: { product_id: dto.product_id, platform: dto.platform, vibe: dto.vibe },
      tokensUsed: result.tokens_used,
      estimatedCost: result.estimated_cost,
      modelUsed: result.model || undefined,
      status: result.from_provider ? 'completed' : 'failed',
      errorMessage: result.provider_configured ? undefined : 'AI_GATEWAY_NOT_CONFIGURED',
    });
    return { success: true, data: result };
  }

  @Post('content/generate-video-script')
  @Roles(ROLES.OPERATOR)
  async generateVideoScript(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateVideoScriptDto) {
    const product = await this.loadProduct(user.tenantId, dto.product_id);
    const result = await this.content.generateVideoScript(
      this.toContext(product),
      dto.video_type,
      dto.duration_seconds,
    );
    await this.ai.logTask({
      tenantId: user.tenantId,
      agentName: 'video_ai',
      taskType: 'generate_video_script',
      inputData: { product_id: dto.product_id, video_type: dto.video_type },
      tokensUsed: result.tokens_used,
      estimatedCost: result.estimated_cost,
      modelUsed: result.model || undefined,
      status: result.from_provider ? 'completed' : 'failed',
      errorMessage: result.provider_configured ? undefined : 'AI_GATEWAY_NOT_CONFIGURED',
    });
    return { success: true, data: result };
  }

  @Post('video/generate')
  @Roles(ROLES.OPERATOR)
  async generateVideoPlan(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateVideoPlanDto) {
    const start = Date.now();
    const product = await this.loadProduct(user.tenantId, dto.product_id);
    const plan = await this.video.generate(
      { name: product.name, category: product.category?.name },
      dto.video_type,
      dto.duration_seconds,
    );

    let savedAssetId: string | null = null;
    if (dto.save) {
      const asset = await this.prisma.contentAsset.create({
        data: {
          tenantId: user.tenantId,
          productId: product.id,
          contentType: 'video_script',
          platform: 'tiktok',
          title: plan.title,
          content: JSON.stringify(plan),
          aiGenerated: plan.from_provider,
          aiModelUsed: plan.from_provider ? 'ai-gateway' : 'template',
          status: 'draft',
        },
        select: { id: true },
      });
      savedAssetId = asset.id;
    }

    await this.ai.logTask({
      tenantId: user.tenantId,
      agentName: 'video_ai',
      taskType: 'generate_video_plan',
      inputData: { product_id: dto.product_id, video_type: dto.video_type, save: dto.save },
      outputData: { from_provider: plan.from_provider, is_template: plan.is_template, saved_asset_id: savedAssetId },
      modelUsed: plan.from_provider ? 'ai-gateway' : 'template',
      executionTimeMs: Date.now() - start,
      status: 'completed',
    });

    return { success: true, data: { plan, saved_asset_id: savedAssetId } };
  }

  @Get('tasks')
  async listTasks(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PaginationDto,
    @Query('agent') agent?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.ai.listTasks(tenantId, query, agent, status);
    return { success: true, ...result };
  }

  @Get('tasks/:id')
  async getTask(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    const data = await this.ai.getTask(tenantId, id);
    return { success: true, data };
  }

  @Patch('tasks/:id/approve')
  @Roles(ROLES.MANAGER)
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveTaskDto,
  ) {
    const data = await this.ai.approveTask(user.tenantId, id, user.userId, dto.approved);
    return { success: true, data };
  }

  @Get('cost/summary')
  @Roles(ROLES.MANAGER)
  async cost(@CurrentUser('tenantId') tenantId: string, @Query('days') days?: string) {
    const data = await this.ai.costSummary(tenantId, Math.min(parseInt(days ?? '7', 10) || 7, 90));
    return { success: true, data };
  }
}
