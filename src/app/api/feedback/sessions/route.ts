import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { listSessions } from '@/lib/feedback-api';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('Failed to list sessions:', err);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 },
    );
  }
}
