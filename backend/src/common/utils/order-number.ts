/** Build an order number: ORD-YYYYMMDD-XXXXX (XXXXX = zero-padded daily seq). */
export function buildOrderNumber(seq: number, now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const s = String(seq).padStart(5, '0');
  return `ORD-${y}${m}${d}-${s}`;
}
