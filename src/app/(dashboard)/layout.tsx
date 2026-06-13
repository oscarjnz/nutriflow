import { BottomNav } from '@/components/shared/bottom-nav';
import { requireUser } from '@/lib/auth/get-user';

/**
 * Authenticated shell. `requireUser()` redirects to `/login` if there is no
 * verified session, so every child route can assume a user is present.
 * Middleware also blocks unauthenticated access at the edge; this layout is
 * the second line of defense and provides the user object for downstream
 * Server Components that need it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col">
      <div className="flex-1 pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
