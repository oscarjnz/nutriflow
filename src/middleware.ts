import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/**
 * Paths that anonymous users may visit. Everything else requires a session
 * and gets redirected to `/login?next=<path>`.
 *
 * Static assets, the manifest, and the service worker are filtered out at
 * the matcher level so they never hit this function.
 */
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/error'];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     *  - _next/static, _next/image  (build assets)
     *  - favicon, icon, apple-icon  (Next-generated icons)
     *  - manifest.webmanifest, sw.js, workbox-*.js  (PWA artifacts)
     *  - anything ending in .svg/.png/.ico  (static media)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
