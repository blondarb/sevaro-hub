import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';

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

  // SECURITY: strip client-supplied resolvedBy/resolvedAt before anything
  // else. The previous handler accepted a caller-supplied override, which let
  // an authenticated admin forge the audit trail by PATCHing arbitrary
  // resolvedBy strings. These fields are owned by the server from here on.
  const { resolvedBy: _ignoredResolvedBy, resolvedAt: _ignoredResolvedAt, ...sanitizedBody } =
    body as Record<string, unknown>;
  void _ignoredResolvedBy;
  void _ignoredResolvedAt;
  const bodyToSend: Record<string, unknown> = { ...sanitizedBody };

  // Decide server-controlled resolution fields based on the real transition.
  // Only look up the prior session when reviewStatus is in the body (the only
  // trigger for stamping or clearing); skip the fetch for unrelated PATCHes
  // (e.g. the triage runner writing triageProposal only).
  if (body.reviewStatus !== undefined) {
    let priorStatus: string | undefined;
    if (appId) {
      try {
        const existing = await getSession(id, appId);
        priorStatus = existing.reviewStatus as string | undefined;
      } catch {
        // Session may not exist yet or fetch may transiently fail — fall
        // through and let the Lambda PATCH handle the 404. We intentionally
        // do not stamp resolvedBy/resolvedAt when prior state is unknown; the
        // downstream PATCH will reject unknown sessions either way.
      }
    }

    if (body.reviewStatus === 'resolved' && priorStatus !== 'resolved') {
      // Real resolve transition — stamp from the verified JWT.
      bodyToSend.resolvedBy = user.email;
      bodyToSend.resolvedAt = new Date().toISOString();
    } else if (body.reviewStatus !== 'resolved' && priorStatus === 'resolved') {
      // Un-resolve transition — clear the audit fields so a subsequent
      // re-resolve produces a fresh, accurate stamp. Lambda interprets null
      // as REMOVE on these attributes.
      bodyToSend.resolvedBy = null;
      bodyToSend.resolvedAt = null;
      bodyToSend.resolutionNote = null;
    }
  }

  const res = await fetch(`${API_URL}/sessions/${id}?appId=${encodeURIComponent(appId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(bodyToSend),
  });

  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({}));
    return NextResponse.json(responseBody, { status: res.status });
  }

  return NextResponse.json({ updated: true });
}
