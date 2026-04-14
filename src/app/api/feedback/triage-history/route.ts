import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import {
  fetchTriageHistory,
  postTriageHistory,
  type TriageHistoryEntry,
} from '@/lib/triage-api';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? Number(daysParam) : 30;

  try {
    const result = await fetchTriageHistory(days);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to fetch triage history:', err);
    return NextResponse.json(
      { error: 'Failed to fetch triage history' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  let body: Omit<TriageHistoryEntry, 'timestamp' | 'reviewerEmail'>;
  try {
    body = (await request.json()) as Omit<
      TriageHistoryEntry,
      'timestamp' | 'reviewerEmail'
    >;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const result = await postTriageHistory({
      ...body,
      reviewerEmail: user.email,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to post triage history:', err);
    return NextResponse.json(
      { error: 'Failed to post triage history' },
      { status: 500 },
    );
  }
}
