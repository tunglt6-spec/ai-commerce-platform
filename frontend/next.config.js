/** @type {import('next').NextConfig} */
const path = require('path');

// Baseline Content-Security-Policy. 'unsafe-inline' is kept for script/style because
// Next.js App Router injects inline hydration bootstrap and Tailwind/Next inject inline
// styles; tightening to a nonce-based policy is tracked as a follow-up. The policy still
// removes framing (clickjacking), plugins/objects, and restricts default/connect origins.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // API is same-origin; keep connect-src tight so an XSS cannot exfiltrate to an
  // arbitrary https host. Add explicit trusted origins here if cross-origin calls appear.
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    // Trace workspace deps from the monorepo root so the standalone bundle is complete.
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  eslint: {
    // Lint is run separately in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;
