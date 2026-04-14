import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import {
  fetchPendingTriageRequests,
  postTriageRequest,
} from '@/lib/triage-api';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  try {
    const result = await fetchPendingTriageRequests();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to fetch triage requests:', err);
    return NextResponse.json(
      { error: 'Failed to fetch triage requests' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  try {
    const body = (await request.json()) as { sessionIds?: unknown };
    if (!Array.isArray(body.sessionIds) || body.sessionIds.length === 0) {
      return NextResponse.json(
        { error: 'sessionIds must be a non-empty array' },
        { status: 400 },
      );
    }
    const sessionIds = body.sessionIds.filter((s): s is string => typeof s === 'string');
    const result = await postTriageRequest(user.email, sessionIds);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to create triage request:', err);
    return NextResponse.json(
      { error: 'Failed to create triage request' },
      { status: 500 },
    );
  }
}
