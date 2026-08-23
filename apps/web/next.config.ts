import path from 'node:path';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  webpack: (config) => {
    // Konva's node build optionally imports `canvas`; the browser bundle
    // must not try to resolve it.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  eslint: {
    // ESLint runs as its own workspace script (`npm run lint`).
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type-checking runs as its own workspace script (`npm run typecheck`).
    ignoreBuildErrors: true,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: {
    // Uploads only when SENTRY_AUTH_TOKEN is present; local/CI builds no-op.
    disable: process.env.SENTRY_AUTH_TOKEN === undefined,
  },
});
