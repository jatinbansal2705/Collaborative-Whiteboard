import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  eslint: {
    // ESLint runs as its own workspace script (`npm run lint`).
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type-checking runs as its own workspace script (`npm run typecheck`).
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
