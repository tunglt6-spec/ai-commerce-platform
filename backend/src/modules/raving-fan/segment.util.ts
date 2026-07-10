/** Customer segmentation rules (FR-CUST-003). Deterministic, from real data. */
export const VIP_LTV_THRESHOLD_VND = 5_000_000;
export const AT_RISK_DAYS = 30;
export const CHURNED_DAYS = 90;

export interface SegmentInput {
  totalOrders: number;
  lifetimeValue: number;
  lastPurchaseAt: Date | null;
}

export function computeSegment(c: SegmentInput, now: Date): string {
  if (c.totalOrders === 0) return 'New';
  const days = c.lastPurchaseAt
    ? (now.getTime() - c.lastPurchaseAt.getTime()) / (24 * 3600 * 1000)
    : Infinity;
  if (days > CHURNED_DAYS) return 'Churned';
  if (days > AT_RISK_DAYS) return 'At-risk';
  if (c.lifetimeValue >= VIP_LTV_THRESHOLD_VND) return 'VIP';
  if (c.totalOrders < 3) return 'New';
  return 'Regular';
}
