import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { patchTriageRequest, type TriageRequestStatus } from '@/lib/triage-api';

const VALID_STATUSES: TriageRequestStatus[] = [
  'pending',
  'processing',
  'done',
  'failed',
  'expired',
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { id } = await params;

  let body: { status?: unknown; processedCount?: unknown };
  try {
    body = (await request.json()) as {
      status?: unknown;
      processedCount?: unknown;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: { status?: TriageRequestStatus; processedCount?: number } = {};

  if (body.status !== undefined) {
    if (
      typeof body.status !== 'string' ||
      !VALID_STATUSES.includes(body.status as TriageRequestStatus)
    ) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }
    updates.status = body.status as TriageRequestStatus;
  }

  if (body.processedCount !== undefined) {
    if (typeof body.processedCount !== 'number') {
      return NextResponse.json(
        { error: 'processedCount must be a number' },
        { status: 400 },
      );
    }
    if (!Number.isInteger(body.processedCount) || body.processedCount < 0) {
      return NextResponse.json(
        { error: 'processedCount must be a non-negative integer' },
        { status: 400 },
      );
    }
    updates.processedCount = body.processedCount;
  }

  try {
    const result = await patchTriageRequest(id, updates);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to patch triage request:', err);
    return NextResponse.json(
      { error: 'Failed to patch triage request' },
      { status: 500 },
    );
  }
}
