import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/privacidad(.*)']);

/**
 * Routes that authenticate themselves and must NOT be handled here.
 *
 * `auth.protect()` answers an unauthenticated request with `notFound()` (see
 * `@clerk/nextjs/server/protect`), so leaving these under the middleware guard
 * turned every tokenless API call into a 404 that looked like a missing route.
 * Every handler under `/api` already does its own `getUser()` + 401 (or, for
 * the cron endpoint, its own `CRON_SECRET` bearer check), so the middleware
 * steps aside and lets them return the correct status.
 *
 * `/__clerk` is Clerk's own proxy path and must never be redirected.
 */
const isSelfGuardedRoute = createRouteMatcher(['/api(.*)', '/trpc(.*)', '/__clerk(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request) || isSelfGuardedRoute(request)) return;

  const { userId } = await auth();
  if (userId) return;

  // Page routes get a redirect instead of the 404 `auth.protect()` produces,
  // so a signed-out visitor landing on the public root reaches the sign-in
  // screen and returns to the page they asked for afterwards.
  const signInUrl = new URL('/sign-in', request.url);
  signInUrl.searchParams.set(
    'redirect_url',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(signInUrl);
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
