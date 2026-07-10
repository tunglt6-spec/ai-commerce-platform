import { buildOrderNumber } from './order-number';

describe('buildOrderNumber', () => {
  it('formats ORD-YYYYMMDD-XXXXX with zero-padded sequence', () => {
    const d = new Date(2026, 6, 10); // 2026-07-10 (month is 0-based)
    expect(buildOrderNumber(1, d)).toBe('ORD-20260710-00001');
    expect(buildOrderNumber(42, d)).toBe('ORD-20260710-00042');
    expect(buildOrderNumber(12345, d)).toBe('ORD-20260710-12345');
  });
});
