import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     *  - _next/static, _next/image  (build assets)
     *  - favicon, icon, apple-icon  (Next-generated icons)
     *  - manifest.webmanifest, sw.js, workbox-*.js  (PWA artifacts)
     *  - static media
     *  - __clerk  (Clerk's internal proxy path)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
