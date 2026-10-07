import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
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

export default nextConfig;
