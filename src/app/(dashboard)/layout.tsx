import { redirect } from 'next/navigation';

import { BottomNav } from '@/components/shared/bottom-nav';
import { requireUser } from '@/lib/auth/get-user';
import { hasCompletedOnboarding } from '@/repositories/user-profile.repo';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Gate: every user (new or pre-existing) must complete the guided onboarding
  // before reaching the app, so the dashboard always has a real plan to show.
  if (!(await hasCompletedOnboarding(user.id))) {
    redirect('/onboarding');
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col">
      <div className="flex-1 pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
