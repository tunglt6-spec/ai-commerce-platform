import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../gateway/ai-gateway.service';

export interface ContentVariation {
  version: number;
  content: string;
}

export interface ContentGenerationResult {
  provider_configured: boolean;
  from_provider: boolean;
  variations: ContentVariation[];
  model: string;
  tokens_used: number;
  estimated_cost: number;
  note?: string;
}

interface ProductContext {
  name: string;
  category?: string;
  retailPrice: number;
  marginPercent: number;
  shortDescription?: string | null;
}

/**
 * Content AI agent (descriptions, captions, video scripts).
 * Uses the AI gateway when configured; otherwise returns a degraded result with
 * `provider_configured:false` and NO fabricated marketing copy.
 */
@Injectable()
export class ContentAgentService {
  constructor(private readonly gateway: AiGatewayService) {}

  async generateDescription(
    product: ProductContext,
    platform: string,
    variations: number,
  ): Promise<ContentGenerationResult> {
    const prompt = `Viết mô tả sản phẩm "${product.name}" cho nền tảng ${platform}.
Danh mục: ${product.category ?? 'chung'}. Giá bán: ${product.retailPrice}. Biên lợi nhuận: ${product.marginPercent}%.
${product.shortDescription ? `Điểm nổi bật: ${product.shortDescription}.` : ''}
Yêu cầu: 200-300 từ, giọng thân thiện, có CTA rõ ràng, kèm hướng dẫn size và bảo quản.`;
    return this.run(prompt, 'content', variations, 900);
  }

  async generateCaption(
    product: ProductContext,
    platform: string,
    vibe: string,
    variations: number,
  ): Promise<ContentGenerationResult> {
    const prompt = `Viết caption mạng xã hội cho "${product.name}" trên ${platform}, tông ${vibe}.
Bao gồm hook, giá trị, CTA và hashtag phù hợp. Dưới 150 ký tự.`;
    return this.run(prompt, 'content', variations, 300);
  }

  async generateVideoScript(
    product: ProductContext,
    videoType: string,
    durationSeconds: number,
  ): Promise<ContentGenerationResult> {
    const prompt = `Viết kịch bản video ${videoType} dài ${durationSeconds}s cho "${product.name}".
Chia theo cảnh (scene), mỗi cảnh có thời lượng, hành động, lời thoại; kèm props và gợi ý nhạc.`;
    return this.run(prompt, 'content', 1, 1200);
  }

  private async run(
    prompt: string,
    role: 'default' | 'content' | 'strategy',
    variations: number,
    maxTokens: number,
  ): Promise<ContentGenerationResult> {
    if (!this.gateway.isConfigured) {
      return {
        provider_configured: false,
        from_provider: false,
        variations: [],
        model: '',
        tokens_used: 0,
        estimated_cost: 0,
        note: 'AI provider is not configured. Set AI_GATEWAY_BASE_URL and AI_GATEWAY_API_KEY to enable generation.',
      };
    }

    const count = Math.min(Math.max(variations, 1), 5);
    const results: ContentVariation[] = [];
    let tokens = 0;
    let cost = 0;
    let model = '';
    let anyProvider = false;

    for (let i = 0; i < count; i++) {
      const res = await this.gateway.complete({
        role,
        system: 'You are a professional e-commerce copywriter. Reply in Vietnamese unless asked otherwise.',
        prompt: count > 1 ? `${prompt}\n(Phiên bản ${i + 1}, khác biệt so với các bản trước.)` : prompt,
        maxTokens,
        temperature: 0.8,
      });
      model = res.model;
      tokens += res.tokensUsed;
      cost += res.estimatedCost;
      if (res.ok && res.fromProvider) {
        anyProvider = true;
        results.push({ version: i + 1, content: res.text.trim() });
      }
    }

    return {
      provider_configured: true,
      from_provider: anyProvider,
      variations: results,
      model,
      tokens_used: tokens,
      estimated_cost: round6(cost),
      note: anyProvider ? undefined : 'AI provider returned no usable output.',
    };
  }
}

function round6(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}
