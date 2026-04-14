import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/verify-auth';
import { AnalyzeClient } from './AnalyzeClient';

export const dynamic = 'force-dynamic';

export default async function AnalyzePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('id_token')?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user?.isAdmin) redirect('/login?next=/feedback/analyze');
  return <AnalyzeClient />;
}
