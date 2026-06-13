import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  // Disable SW in dev so HMR is not intercepted by stale precached assets.
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // typedRoutes requires a completed build to generate route types.
    // Re-enable after `pnpm build` when all routes are stable.
    typedRoutes: false,
  },
  // Postgres driver and serwist worker glue are server-only; never bundle for the client.
  serverExternalPackages: ['postgres'],
};

export default withSerwist(nextConfig);
