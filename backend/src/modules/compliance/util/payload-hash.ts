import { createHash } from 'crypto';

/**
 * Deterministic, order-independent hash of an action payload. Used to bind a
 * policy decision / approval to the exact payload it was granted for, so any
 * later mutation invalidates the decision (VI.9, VI.10, XVI).
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonicalize((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

/** Hash of an arbitrary record for the immutable audit before/after fields. */
export function stateHash(state: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(state ?? null))).digest('hex');
}
