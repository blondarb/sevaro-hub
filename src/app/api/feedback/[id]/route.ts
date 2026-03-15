import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';

const API_URL = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const API_KEY = process.env.FEEDBACK_API_KEY || '';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId') || '';

  const res = await fetch(`${API_URL}/sessions/${id}?appId=${encodeURIComponent(appId)}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  }

  return NextResponse.json({ deleted: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId') || body.appId || '';

  const res = await fetch(`${API_URL}/sessions/${id}?appId=${encodeURIComponent(appId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      ...body,
      resolvedBy: user.email,
    }),
  });

  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({}));
    return NextResponse.json(responseBody, { status: res.status });
  }

  return NextResponse.json({ updated: true });
}
