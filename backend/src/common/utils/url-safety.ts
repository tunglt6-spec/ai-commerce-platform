import { lookup } from 'dns/promises';
import { lookup as dnsLookupCb } from 'dns';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';
import { Agent } from 'undici';

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

// 198.18.0.0/15 (RFC 2544 benchmarking) — ipaddr.js 1.9.x reports it as unicast, so
// we block it explicitly in addition to ipaddr's own special-range classification.
const BENCHMARK_V4 = ipaddr.IPv4.parseCIDR('198.18.0.0/15');

function v4NonPublic(a: ipaddr.IPv4): boolean {
  return a.range() !== 'unicast' || a.match(BENCHMARK_V4);
}

/**
 * True unless the address is ordinary public unicast. Uses ipaddr.js for robust,
 * spec-correct classification across ALL IPv4/IPv6 forms (compressed, uncompressed,
 * IPv4-mapped AND IPv4-compatible, hex). Anything that is not public unicast (loopback,
 * private, link-local incl. cloud metadata 169.254.169.254, ULA, CGNAT, reserved,
 * benchmarking, multicast, teredo/6to4, …) or does not parse is treated as unsafe.
 */
export function isPrivateAddress(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return true; // unparseable → unsafe
  const addr = ipaddr.parse(ip);
  if (addr.kind() === 'ipv4') return v4NonPublic(addr as ipaddr.IPv4);

  const v6 = addr as ipaddr.IPv6;
  if (v6.isIPv4MappedAddress()) return v4NonPublic(v6.toIPv4Address()); // ::ffff:a.b.c.d
  const b = v6.toByteArray();
  const first12Zero = b.slice(0, 12).every((x) => x === 0);
  const last4 = ((b[12] << 24) >>> 0) + (b[13] << 16) + (b[14] << 8) + b[15];
  if (first12Zero && last4 > 1) {
    // IPv4-compatible ::a.b.c.d (deprecated) — evaluate the embedded IPv4 (skips ::/::1).
    return v4NonPublic(ipaddr.fromByteArray(b.slice(12)) as ipaddr.IPv4);
  }
  return v6.range() !== 'unicast';
}

/**
 * undici dispatcher that re-validates the address AT CONNECT TIME using a custom DNS
 * lookup — so the IP that is actually connected to is the same one that was checked. This
 * closes the DNS-rebinding TOCTOU between `assertSafeExternalUrl` and `fetch()`. Pass it as
 * `fetch(url, { dispatcher: ssrfSafeDispatcher })`. TLS still uses the original hostname
 * for SNI/cert validation; only the resolved IP is pinned.
 */
export const ssrfSafeDispatcher = new Agent({
  connect: {
    lookup(hostname: string, options: any, callback: (err: Error | null, address: string, family: number) => void) {
      dnsLookupCb(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, '', 0);
        const list = Array.isArray(addresses) ? addresses : [];
        if (!list.length) return callback(new Error('SSRF_BLOCKED: host does not resolve'), '', 0);
        for (const a of list) {
          if (isPrivateAddress(a.address)) return callback(new Error('SSRF_BLOCKED: resolves to private address'), '', 0);
        }
        callback(null, list[0].address, list[0].family);
      });
    },
  },
});

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
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  // Explicit allow-list escape hatch — EMPTY in production. Only used by local
  // integration tests that point verify_url/webhook_url at a 127.0.0.1 mock server.
  // Scheme + credential checks above still apply to allow-listed hosts.
  const allow = (process.env.SSRF_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.includes(host)) return;

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
