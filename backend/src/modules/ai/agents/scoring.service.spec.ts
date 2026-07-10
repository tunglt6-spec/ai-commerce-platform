import { ScoringService } from './scoring.service';

describe('ScoringService', () => {
  const svc = new ScoringService();

  it('gives full margin score at >=50% margin', () => {
    const r = svc.score({ costPrice: 50, retailPrice: 100, tags: [], hasImages: true });
    expect(r.profit_margin_score).toBe(25); // (0.5/0.5)*25
  });

  it('scales margin score linearly below 50%', () => {
    const r = svc.score({ costPrice: 75, retailPrice: 100 }); // 25% margin
    expect(r.profit_margin_score).toBeCloseTo(12.5, 1);
  });

  it('handles zero retail price safely (no divide-by-zero)', () => {
    const r = svc.score({ costPrice: 0, retailPrice: 0 });
    expect(r.profit_margin_score).toBe(0);
    expect(r.total_score).toBeGreaterThanOrEqual(0);
  });

  it('boosts demand for trending/bestseller tags', () => {
    const base = svc.score({ costPrice: 50, retailPrice: 100 });
    const boosted = svc.score({ costPrice: 50, retailPrice: 100, tags: ['trending', 'bestseller'] });
    expect(boosted.demand_score).toBeGreaterThan(base.demand_score);
    expect(boosted.risk_score).toBeLessThan(base.risk_score);
  });

  it('keeps total within 0..100 and assigns a recommendation', () => {
    const r = svc.score({ costPrice: 10, retailPrice: 100, tags: ['trending', 'bestseller'], hasImages: true });
    expect(r.total_score).toBeGreaterThanOrEqual(0);
    expect(r.total_score).toBeLessThanOrEqual(100);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(r.recommendation);
  });

  it('uses market signals when provided', () => {
    const r = svc.score({ costPrice: 50, retailPrice: 100, demandSignal: 1, competitionSignal: 0 });
    expect(r.demand_score).toBe(25);
    expect(r.competition_score).toBe(20);
  });
});
