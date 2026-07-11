/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Trace workspace deps from the monorepo root so the standalone bundle is complete.
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  eslint: {
    // Lint is run separately in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
