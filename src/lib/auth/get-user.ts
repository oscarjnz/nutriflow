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

const PROFILE_COLUMNS = {
  id: users.id,
  clerkId: users.clerkId,
  displayName: users.displayName,
  locale: users.locale,
  units: users.units,
} as const;

async function selectByClerkId(clerkId: string): Promise<InternalUser | null> {
  const rows = await adminDb
    .select(PROFILE_COLUMNS)
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return (rows[0] as InternalUser | undefined) ?? null;
}

async function getOrCreateProfile(clerkId: string): Promise<InternalUser> {
  const existing = await selectByClerkId(clerkId);
  if (existing) return existing;

  const clerkUser = await clerkCurrentUser();
  const displayName =
    clerkUser?.firstName ??
    clerkUser?.emailAddresses[0]?.emailAddress?.split('@')[0] ??
    null;

  const id = newId();

  // Concurrent first-load requests (RSC prefetch + page render) race to create
  // the same profile. onConflictDoNothing on the unique clerk_id makes the
  // insert idempotent; settings are only seeded by the request that won.
  await adminDb.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ id, clerkId, displayName })
      .onConflictDoNothing({ target: users.clerkId })
      .returning({ id: users.id });

    const winnerId = inserted[0]?.id;
    if (winnerId) {
      await tx.insert(userSettings).values({ userId: winnerId }).onConflictDoNothing();
    }
  });

  const created = await selectByClerkId(clerkId);
  if (!created) {
    throw new Error(`Failed to materialize profile for Clerk user ${clerkId}`);
  }
  return created;
}
