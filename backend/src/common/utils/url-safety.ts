import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * SSRF guard for server-side fetches of externally/tenant-supplied URLs
 * (integration webhook_url / verify_url, Shopee product image URLs).
 *
 * Rejects:
 *  - non-http(s) schemes (file:, gopher:, data:, etc.)
 *  - credentials in the URL (user:pass@)
 *  - loopback, private, link-local, unique-local and cloud-metadata targets,
 *    checked against BOTH the literal host and its resolved DNS addresses
 *    (mitigates DNS-rebinding to an internal address).
 *
 * This is a best-effort control: it resolves the hostname once and validates the
 * result, but a TOCTOU rebind between this check and the actual connect is still
 * theoretically possible. Treat as defense-in-depth alongside network egress rules.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
]);

/** True if an IPv4/IPv6 literal is loopback / private / link-local / ULA / metadata. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // treat unparseable as unsafe
    const [a, b] = p;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 192 && b === 0 && p[2] === 0) return true; // 192.0.0.0/24 IETF protocol assignments
    if (a === 192 && b === 88 && p[2] === 99) return true; // 192.88.99.0/24 6to4 relay anycast
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
    // IPv4-mapped / IPv4-compatible embedded address — the WHATWG URL parser serializes
    // ::ffff:127.0.0.1 to the HEX form ::ffff:7f00:1, so handle both dotted and hex.
    const dotted = lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateAddress(dotted[1]);
    const hex = lower.match(/^::(?:ffff:)?(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }
  // Not a valid IP literal.
  return false;
}

/**
 * Validate a URL is safe to fetch server-side. Throws Error('SSRF_BLOCKED: ...') if not.
 * Async because it resolves the hostname to catch internal targets behind public names.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('SSRF_BLOCKED: invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`SSRF_BLOCKED: scheme ${url.protocol} not allowed`);
  }
  if (url.username || url.password) {
    throw new Error('SSRF_BLOCKED: credentials in URL not allowed');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('SSRF_BLOCKED: disallowed host');
  }
  // Literal IP host: validate directly.
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('SSRF_BLOCKED: private/loopback address');
    return;
  }
  // Hostname: resolve and validate every returned address.
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error('SSRF_BLOCKED: host does not resolve');
  }
  if (!addrs.length) throw new Error('SSRF_BLOCKED: host does not resolve');
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) throw new Error('SSRF_BLOCKED: resolves to private address');
  }
}

/** Non-throwing convenience wrapper. */
export async function isSafeExternalUrl(rawUrl: string): Promise<boolean> {
  try {
    await assertSafeExternalUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
