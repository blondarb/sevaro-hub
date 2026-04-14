import { NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { postTriageHistory } from '@/lib/triage-api';

const FEEDBACK_API_URL =
  process.env.FEEDBACK_API_URL ||
  'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const FEEDBACK_API_KEY = process.env.FEEDBACK_API_KEY || '';

const VALID_REASONS = [
  'not_a_real_issue',
  'already_fixed',
  'low_priority',
  'duplicate',
  'out_of_scope',
  'need_more_info',
] as const;
type RejectionReason = (typeof VALID_REASONS)[number];

function isValidReason(value: unknown): value is RejectionReason {
  return (
    typeof value === 'string' &&
    (VALID_REASONS as readonly string[]).includes(value)
  );
}

interface RejectProposalBody {
  appId?: string;
  reason?: string;
  comment?: string;
}

interface TriageProposalLike {
  themeId?: string;
  classification?: string;
  confidence?: number;
  suspectedRepo?: string;
  [key: string]: unknown;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const { id: sessionId } = await params;

  let body: RejectProposalBody;
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as RejectProposalBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidReason(body.reason)) {
    return NextResponse.json(
      { error: 'Invalid or missing rejection reason' },
      { status: 400 },
    );
  }
  const reason: RejectionReason = body.reason;

  const { searchParams } = new URL(request.url);
  const appId = body.appId || searchParams.get('appId') || '';

  try {
    const session = await getSession(sessionId, appId);
    const proposal = (session as unknown as { triageProposal?: TriageProposalLike | null })
      .triageProposal;

    if (!proposal) {
      return NextResponse.json(
        { error: 'no triage proposal on session' },
        { status: 404 },
      );
    }

    await postTriageHistory({
      sessionId,
      action: 'rejected',
      themeId: proposal.themeId,
      reviewerEmail: user.email,
      rejectionReason: reason,
      rejectionComment: body.comment,
      proposalSnapshot: proposal as Record<string, unknown>,
    });

    const patchRes = await fetch(
      `${FEEDBACK_API_URL}/sessions/${sessionId}?appId=${encodeURIComponent(
        session.appId,
      )}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': FEEDBACK_API_KEY,
        },
        body: JSON.stringify({
          appId: session.appId,
          reviewStatus: 'dismissed',
          resolvedBy: user.email,
          resolvedAt: new Date().toISOString(),
          triageProposal: null,
        }),
      },
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to patch session after rejection',
          detail: errBody,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
