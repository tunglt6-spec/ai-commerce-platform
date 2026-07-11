import { Injectable } from '@nestjs/common';
import { ACTION_BASE_RISK, RISK } from '../compliance.constants';

export interface RiskFactors {
  actionType: string;
  platform?: string | null;
  productCategory?: string | null;
  dataSensitivity?: 'none' | 'low' | 'high' | 'sensitive';
  hasClaims?: boolean;
  assetUnverified?: boolean;
  financialImpact?: number;
  batchSize?: number;
  agentMaxRisk?: number;
  policyStale?: boolean;
  evidenceMissing?: boolean;
  consentInvalid?: boolean;
  historicalIncidents?: number;
}

export interface RiskResult {
  riskLevel: number; // 0..5
  riskScore: number; // 0..100 deterministic score
  reasons: string[];
}

/**
 * Deterministic risk model (VII). An LLM is never the sole source of a risk
 * decision — this service computes the authoritative score from concrete factors.
 */
@Injectable()
export class RiskService {
  score(f: RiskFactors): RiskResult {
    const reasons: string[] = [];
    let level = ACTION_BASE_RISK[f.actionType];
    if (level === undefined) {
      // Unknown action -> treat as high-risk external, fail-closed.
      level = RISK.FINANCIAL_OR_LEGAL;
      reasons.push('Hành động không xác định — nâng mức rủi ro (fail-closed).');
    }

    let score = level * 15; // base 0..75

    const bump = (n: number, why: string) => {
      score += n;
      reasons.push(why);
    };

    if (f.dataSensitivity === 'sensitive') bump(15, 'Dữ liệu nhạy cảm.');
    else if (f.dataSensitivity === 'high') bump(8, 'Dữ liệu độ nhạy cao.');

    if (f.hasClaims) bump(6, 'Nội dung có tuyên bố (claim).');
    if (f.assetUnverified) bump(8, 'Tài sản chưa xác minh quyền.');
    if (f.evidenceMissing) bump(8, 'Thiếu bằng chứng bắt buộc.');
    if (f.consentInvalid) bump(12, 'Consent không hợp lệ.');
    if (f.policyStale) bump(6, 'Policy/platform pack quá hạn rà soát.');

    if (typeof f.financialImpact === 'number' && f.financialImpact > 0) {
      if (f.financialImpact >= 5_000_000) bump(12, 'Ảnh hưởng tài chính lớn.');
      else if (f.financialImpact >= 1_000_000) bump(6, 'Ảnh hưởng tài chính trung bình.');
    }

    if (typeof f.batchSize === 'number' && f.batchSize > 50) bump(8, 'Batch lớn (>50).');
    else if (typeof f.batchSize === 'number' && f.batchSize > 10) bump(4, 'Batch trung bình (>10).');

    if (f.historicalIncidents && f.historicalIncidents > 0) {
      bump(Math.min(10, f.historicalIncidents * 3), 'Có lịch sử vi phạm.');
    }

    // Factors can escalate the level but never silently lower the action base.
    if (score >= 90 && level < RISK.PROHIBITED) {
      level = Math.max(level, RISK.FINANCIAL_OR_LEGAL);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    return { riskLevel: level, riskScore: score, reasons };
  }
}
