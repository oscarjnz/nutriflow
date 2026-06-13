import 'server-only';

import { auth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { adminDb } from '@/db/client';
import { users, userSettings } from '@/db/schema';
import { newId } from '@/lib/crypto/uuid';

export type InternalUser = {
  id: string;
  clerkId: string;
  displayName: string | null;
  locale: string;
  units: 'metric' | 'imperial';
};

/**
 * Returns the internal user row for the current Clerk session, or null if
 * there is no active session. On first login, creates the profile + settings
 * row automatically.
 */
export async function getUser(): Promise<InternalUser | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  return getOrCreateProfile(clerkId);
}

/**
 * Returns the internal user or redirects to /sign-in.
 */
export async function requireUser(): Promise<InternalUser> {
  const user = await getUser();
  if (!user) redirect('/sign-in');
  return user;
}

async function getOrCreateProfile(clerkId: string): Promise<InternalUser> {
  const existing = await adminDb
    .select({
      id: users.id,
      clerkId: users.clerkId,
      displayName: users.displayName,
      locale: users.locale,
      units: users.units,
    })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existing[0]) return existing[0] as InternalUser;

  const clerkUser = await clerkCurrentUser();
  const displayName =
    clerkUser?.firstName ??
    clerkUser?.emailAddresses[0]?.emailAddress?.split('@')[0] ??
    null;

  const id = newId();

  await adminDb.transaction(async (tx) => {
    await tx.insert(users).values({ id, clerkId, displayName });
    await tx.insert(userSettings).values({ userId: id });
  });

  return { id, clerkId, displayName, locale: 'es', units: 'metric' };
}
