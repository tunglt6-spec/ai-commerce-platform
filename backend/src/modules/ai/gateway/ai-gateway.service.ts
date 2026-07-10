import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiCompletionRequest {
  /** Logical model role — mapped to a concrete model by config. */
  role?: 'default' | 'content' | 'strategy';
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiCompletionResult {
  ok: boolean;
  /** True when a real provider produced this output. */
  fromProvider: boolean;
  text: string;
  model: string;
  tokensUsed: number;
  estimatedCost: number;
  error?: string;
}

// Approximate per-1M-token USD pricing (Q2 2026 estimate; see 08_Budget_Plan).
const PRICING: Record<string, { in: number; out: number }> = {
  'gemini-flash': { in: 0.075, out: 0.3 },
  'qwen-3': { in: 0.05, out: 0.15 },
  'claude-sonnet': { in: 3, out: 15 },
};

/**
 * LiteLLM/OpenRouter-compatible AI gateway adapter.
 *
 * If no gateway is configured (AI_GATEWAY_BASE_URL/API_KEY empty), calls return
 * `ok:false, fromProvider:false` so callers apply graceful fallback. This module
 * NEVER fabricates provider output disguised as real data.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return !!this.config.get<string>('ai.baseUrl') && !!this.config.get<string>('ai.apiKey');
  }

  private resolveModel(role: AiCompletionRequest['role']): string {
    switch (role) {
      case 'content':
        return this.config.get<string>('ai.modelContent') as string;
      case 'strategy':
        return this.config.get<string>('ai.modelStrategy') as string;
      default:
        return this.config.get<string>('ai.modelDefault') as string;
    }
  }

  private estimateCost(model: string, inTokens: number, outTokens: number): number {
    const p = PRICING[model] ?? PRICING['gemini-flash'];
    return (inTokens * p.in + outTokens * p.out) / 1_000_000;
  }

  /** Rough token estimate (~4 chars/token) for cost tracking. */
  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const model = this.resolveModel(req.role);

    if (!this.isConfigured) {
      return {
        ok: false,
        fromProvider: false,
        text: '',
        model,
        tokensUsed: 0,
        estimatedCost: 0,
        error: 'AI_GATEWAY_NOT_CONFIGURED',
      };
    }

    const baseUrl = this.config.get<string>('ai.baseUrl') as string;
    const apiKey = this.config.get<string>('ai.apiKey') as string;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const messages = [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        { role: 'user', content: req.prompt },
      ];
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 1000,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`AI gateway returned ${res.status}: ${body.slice(0, 200)}`);
        return {
          ok: false,
          fromProvider: false,
          text: '',
          model,
          tokensUsed: 0,
          estimatedCost: 0,
          error: `AI_GATEWAY_HTTP_${res.status}`,
        };
      }

      const json: any = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? '';
      const usage = json?.usage ?? {};
      const inTokens = usage.prompt_tokens ?? this.estimateTokens(req.prompt + (req.system ?? ''));
      const outTokens = usage.completion_tokens ?? this.estimateTokens(text);

      return {
        ok: true,
        fromProvider: true,
        text,
        model,
        tokensUsed: inTokens + outTokens,
        estimatedCost: this.estimateCost(model, inTokens, outTokens),
      };
    } catch (err) {
      const message = (err as Error).name === 'AbortError' ? 'AI_GATEWAY_TIMEOUT' : 'AI_GATEWAY_ERROR';
      this.logger.warn(`AI gateway call failed: ${message}`);
      return { ok: false, fromProvider: false, text: '', model, tokensUsed: 0, estimatedCost: 0, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
