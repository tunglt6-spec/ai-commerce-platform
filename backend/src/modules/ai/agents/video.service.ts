import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../gateway/ai-gateway.service';

export interface VideoScene {
  scene: number;
  duration_seconds: number;
  action: string;
  voiceover: string;
}

export interface VideoPlan {
  from_provider: boolean;
  is_template: boolean;
  title: string;
  video_type: string;
  total_duration_seconds: number;
  scenes: VideoScene[];
  shot_list: string[];
  assets_needed: string[];
  music_mood: string;
  note?: string;
}

interface ProductContext {
  name: string;
  category?: string;
}

/**
 * Video AI: produces a structured video plan (scenes, shot list, voiceover, assets).
 * With a provider it is AI-authored; without one it returns a clearly-labeled
 * deterministic *template scaffold* (is_template:true, from_provider:false) — a
 * starting structure, never fabricated AI output presented as real.
 */
@Injectable()
export class VideoAgentService {
  constructor(private readonly gateway: AiGatewayService) {}

  async generate(product: ProductContext, videoType: string, duration: number): Promise<VideoPlan> {
    if (this.gateway.isConfigured) {
      const res = await this.gateway.complete({
        role: 'content',
        system: 'Bạn là đạo diễn video thương mại. Trả về kế hoạch quay chi tiết bằng tiếng Việt.',
        prompt: `Lập kế hoạch video ${videoType} ~${duration}s cho sản phẩm "${product.name}" (${product.category ?? 'chung'}). Gồm: các cảnh (thời lượng, hành động, lời thoại), shot list, đạo cụ, nhạc nền.`,
        maxTokens: 1200,
      });
      if (res.ok && res.fromProvider) {
        return {
          from_provider: true,
          is_template: false,
          title: `${product.name} — ${videoType}`,
          video_type: videoType,
          total_duration_seconds: duration,
          scenes: [],
          shot_list: [],
          assets_needed: [],
          music_mood: '',
          note: res.text.trim(),
        };
      }
    }
    return this.template(product, videoType, duration);
  }

  /** Deterministic scaffold by video type (honest starting template). */
  private template(product: ProductContext, videoType: string, duration: number): VideoPlan {
    const per = Math.max(3, Math.round(duration / 4));
    const flows: Record<string, string[]> = {
      unboxing: ['Giới thiệu hộp sản phẩm', 'Mở hộp & cận cảnh', 'Nêu bật chất liệu/điểm mạnh', 'CTA mua hàng'],
      'try-on': ['Giới thiệu bối cảnh', 'Mặc thử & phối đồ', 'Cảm nhận & size', 'CTA mua hàng'],
      tutorial: ['Vấn đề khách gặp', 'Giải pháp bằng sản phẩm', 'Hướng dẫn dùng', 'CTA mua hàng'],
      testimonial: ['Khách chia sẻ nhu cầu', 'Trải nghiệm sản phẩm', 'Kết quả & đánh giá', 'CTA mua hàng'],
    };
    const steps = flows[videoType] ?? flows.unboxing;
    const scenes: VideoScene[] = steps.map((action, i) => ({
      scene: i + 1,
      duration_seconds: per,
      action,
      voiceover: `[${product.name}] ${action}`,
    }));
    return {
      from_provider: false,
      is_template: true,
      title: `${product.name} — ${videoType}`,
      video_type: videoType,
      total_duration_seconds: per * scenes.length,
      scenes,
      shot_list: ['Cận cảnh sản phẩm', 'Toàn cảnh sử dụng', 'Chi tiết chất liệu', 'Ảnh CTA cuối'],
      assets_needed: ['Sản phẩm', 'Phông nền sạch', 'Đèn', 'Nhạc nền'],
      music_mood: 'upbeat, energetic',
      note: 'Template scaffold — cấu hình AI provider để tạo kế hoạch chi tiết hơn.',
    };
  }
}
