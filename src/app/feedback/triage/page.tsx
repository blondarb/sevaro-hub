import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/verify-auth';
import { listSessions } from '@/lib/feedback-api';
import { TriageClient } from './TriageClient';

export const dynamic = 'force-dynamic';

export default async function TriagePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('id_token')?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user?.isAdmin) redirect('/login?next=/feedback/triage');

  const allSessions = await listSessions();
  const withProposals = allSessions.filter((s) => s.triageProposal);

  return <TriageClient initialSessions={withProposals} />;
}
