import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiGatewayService } from '../ai/gateway/ai-gateway.service';
import { AiService } from '../ai/ai.service';
import { FaqService } from './faq.service';

export interface SalesResponse {
  from_provider: boolean;
  suggestions: string[];
  matched_faq: { question: string; answer: string }[];
  note?: string;
}

/**
 * Sales AI: answers customer questions grounded in the tenant's FAQ + product
 * data. Guardrail: it only ever surfaces real FAQ answers as suggestions when
 * no AI provider is configured (no fabricated promises). With a provider, it
 * composes a grounded reply from the retrieved FAQ context.
 */
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faq: FaqService,
    private readonly gateway: AiGatewayService,
    private readonly ai: AiService,
  ) {}

  async respond(tenantId: string, question: string, productId?: string): Promise<SalesResponse> {
    const start = Date.now();
    const matches = await this.faq.search(tenantId, question, 3);
    const matched_faq = matches.map((m) => ({ question: m.question, answer: m.answer }));

    let productContext = '';
    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { name: true, retailPrice: true, shortDescription: true },
      });
      if (product) {
        productContext = `Sản phẩm: ${product.name}, giá ${product.retailPrice}. ${product.shortDescription ?? ''}`;
      }
    }

    if (!this.gateway.isConfigured) {
      await this.ai.logTask({
        tenantId,
        agentName: 'sales_ai',
        taskType: 'respond',
        inputData: { question, productId },
        status: 'failed',
        errorMessage: 'AI_GATEWAY_NOT_CONFIGURED',
        executionTimeMs: Date.now() - start,
      });
      return {
        from_provider: false,
        suggestions: matched_faq.map((m) => m.answer),
        matched_faq,
        note:
          matched_faq.length > 0
            ? 'AI provider chưa cấu hình — trả về câu trả lời FAQ phù hợp nhất (dữ liệu thật).'
            : 'AI provider chưa cấu hình và không tìm thấy FAQ phù hợp.',
      };
    }

    const context = matched_faq.map((m, i) => `(${i + 1}) Hỏi: ${m.question}\nĐáp: ${m.answer}`).join('\n');
    const res = await this.gateway.complete({
      role: 'default',
      system:
        'Bạn là trợ lý bán hàng. CHỈ trả lời dựa trên FAQ và thông tin sản phẩm được cung cấp. ' +
        'Không hứa hẹn giảm giá/tồn kho/thời gian giao ngoài dữ liệu. Nếu không đủ thông tin, đề nghị chuyển nhân viên.',
      prompt: `Khách hỏi: "${question}"\n${productContext}\nFAQ liên quan:\n${context || '(không có)'}\n\nSoạn 2 phương án trả lời ngắn gọn, lịch sự.`,
      maxTokens: 400,
    });

    await this.ai.logTask({
      tenantId,
      agentName: 'sales_ai',
      taskType: 'respond',
      inputData: { question, productId },
      modelUsed: res.model,
      tokensUsed: res.tokensUsed,
      estimatedCost: res.estimatedCost,
      status: res.ok ? 'completed' : 'failed',
      executionTimeMs: Date.now() - start,
    });

    return {
      from_provider: res.ok && res.fromProvider,
      suggestions: res.ok && res.text ? [res.text.trim()] : matched_faq.map((m) => m.answer),
      matched_faq,
      note: res.ok ? undefined : 'AI provider lỗi — trả về FAQ phù hợp.',
    };
  }
}
