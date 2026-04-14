import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { fetchThemes } from '@/lib/triage-api';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  try {
    const result = await fetchThemes();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to fetch themes:', err);
    return NextResponse.json(
      { error: 'Failed to fetch themes' },
      { status: 500 },
    );
  }
}
