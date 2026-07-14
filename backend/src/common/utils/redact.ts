/**
 * Structured redaction for anything that might reach a log or an error surface.
 * Masks values whose KEY looks sensitive (tokens, secrets, passwords, partner_key,
 * authorization headers, api keys) and masks token-shaped VALUES defensively.
 * Never mutates the input.
 */

// Strong markers: match anywhere in the key (catches secretKey, tokenId, client_secret,
// apiKeyValue, secretRef, tokenHash, refreshToken, X-Commerce-Signature, ...).
const SENSITIVE_SUBSTR =
  /(pass(word|wd)?|secret|token|partner[_-]?key|api[_-]?key|apikey|authorization|cookie|refresh|access[_-]?token|private[_-]?key|enc[_-]?key|signature|credential)/i;
// Short/ambiguous markers: only when they are the WHOLE key (avoid masking "shipping", "design").
const SENSITIVE_EXACT = /^(pin|otp|cvv|auth|sign|key|pwd|token)$/i;

function isSensitiveKey(k: string): boolean {
  return SENSITIVE_SUBSTR.test(k) || SENSITIVE_EXACT.test(k);
}

const MASK = '«redacted»';

/** Redact a JWT / long opaque token appearing inside a string value. */
function maskTokenLikeString(v: string): string {
  // Credentials embedded in a URL / connection string: scheme://user:pass@host...
  // (e.g. DATABASE_URL=postgresql://user:s3cret@db:5432/app). Mask the password portion.
  if (/^[a-z][a-z0-9+.-]*:\/\/[^:@\s/]+:[^@\s/]+@/i.test(v)) {
    return v.replace(/^([a-z][a-z0-9+.-]*:\/\/[^:@\s/]+):[^@\s/]+@/i, `$1:${MASK}@`);
  }
  // JWT (three base64url segments)
  if (/^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}$/.test(v)) return MASK;
  // Bearer <token>
  if (/^Bearer\s+\S+/i.test(v)) return 'Bearer «redacted»';
  // Long hex/base64 blob (>=40 chars) — likely a key/hash/opaque token
  if (/^[A-Fa-f0-9]{40,}$/.test(v) || /^[A-Za-z0-9+/=_-]{40,}$/.test(v)) return MASK;
  return v;
}

export function redactSecrets<T>(input: T, depth = 0): T {
  if (input == null) return input;
  // At the depth cap, fail safe: mask rather than emit raw (possibly-secret) data.
  if (depth > 8) return (typeof input === 'object' ? MASK : maskTokenLikeString(String(input))) as unknown as T;
  if (typeof input === 'string') return maskTokenLikeString(input) as unknown as T;
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((v) => redactSecrets(v, depth + 1)) as unknown as T;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      out[k] = MASK;
    } else {
      out[k] = redactSecrets(v, depth + 1);
    }
  }
  return out as unknown as T;
}

/** Convenience: safe JSON string for logging. */
export function safeStringify(input: unknown): string {
  try {
    return JSON.stringify(redactSecrets(input));
  } catch {
    return '[unserializable]';
  }
}
