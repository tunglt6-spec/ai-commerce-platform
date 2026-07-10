import { Injectable } from '@nestjs/common';

export interface ScoringInput {
  costPrice: number;
  retailPrice: number;
  tags?: string[];
  hasImages?: boolean;
  /** Optional market signals (supplied by Trend Hunter AI when available). */
  demandSignal?: number; // 0..1
  competitionSignal?: number; // 0..1 (1 = highly competitive)
}

export interface ScoreBreakdown {
  demand_score: number; // 0-25
  competition_score: number; // 0-20
  profit_margin_score: number; // 0-25
  content_viability_score: number; // 0-15
  risk_score: number; // 0-15 (lower = safer)
  total_score: number; // 0-100
  recommendation: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Product opportunity scoring (formula from 02_Functional_Requirements FR-AI-PROD-001
 * and 05_Workflow_Agent_Documentation §3.2).
 *
 * This is a deterministic, auditable baseline. Profit margin is computed exactly
 * from cost/retail. Demand/competition use market signals when provided by
 * Trend Hunter AI; otherwise a documented neutral baseline is used (NOT fabricated
 * as if sourced from live market data).
 */
@Injectable()
export class ScoringService {
  score(input: ScoringInput): ScoreBreakdown {
    const tags = (input.tags ?? []).map((t) => t.toLowerCase());
    const isTrending = tags.includes('trending');
    const isBestseller = tags.includes('bestseller');
    const isSeasonal = tags.includes('seasonal');

    // Profit margin (exact): margin % of retail price.
    const margin =
      input.retailPrice > 0 ? (input.retailPrice - input.costPrice) / input.retailPrice : 0;
    const profit_margin_score = clamp(round2((margin / 0.5) * 25), 0, 25);

    // Demand: use signal if provided, else neutral baseline + tag boosts.
    const demandBase =
      input.demandSignal != null ? input.demandSignal * 25 : 15 + (isTrending ? 6 : 0) + (isBestseller ? 3 : 0);
    const demand_score = clamp(round2(demandBase), 0, 25);

    // Competition: lower competition => higher score (max 20).
    const competitionBase =
      input.competitionSignal != null ? (1 - input.competitionSignal) * 20 : 12 - (isSeasonal ? 0 : 0);
    const competition_score = clamp(round2(competitionBase), 0, 20);

    // Content viability: baseline + image availability.
    const content_viability_score = clamp(round2(10 + (input.hasImages ? 5 : 0)), 0, 15);

    // Risk: baseline moderate; bestsellers are lower risk.
    const risk_score = clamp(round2(8 - (isBestseller ? 3 : 0)), 0, 15);

    // Total: demand + margin + content + (low) competition, minus risk penalty.
    // risk_score is a penalty (0 best, 15 worst) subtracted from a 15-pt allowance.
    const total = round2(
      demand_score + competition_score + profit_margin_score + content_viability_score + (15 - risk_score),
    );
    const total_score = clamp(total, 0, 100);

    const recommendation: ScoreBreakdown['recommendation'] =
      total_score >= 75 ? 'HIGH' : total_score >= 50 ? 'MEDIUM' : 'LOW';

    return {
      demand_score,
      competition_score,
      profit_margin_score,
      content_viability_score,
      risk_score,
      total_score,
      recommendation,
    };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
