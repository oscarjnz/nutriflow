import type { Metadata } from 'next';

import { requireUser } from '@/lib/auth/get-user';

import { LogClient } from './log-client';

export const metadata: Metadata = { title: 'Registrar' };

export default async function LogPage() {
  await requireUser();
  return <LogClient />;
}
