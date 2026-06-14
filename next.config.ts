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
  typedRoutes: false,
  // Lint is advisory, not a deploy gate: style nits (import order, etc.) must
  // never block a Vercel build. Run `pnpm lint` locally / in CI for feedback.
  // TypeScript errors STILL block the build — those catch real bugs.
  eslint: { ignoreDuringBuilds: true },
  // Postgres driver and serwist worker glue are server-only; never bundle for the client.
  serverExternalPackages: ['postgres'],
};

export default withSerwist(nextConfig);
