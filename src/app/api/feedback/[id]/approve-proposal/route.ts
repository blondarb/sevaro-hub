import { NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { createImprovementFromProposal } from '@/lib/improvement-queue-api';
import { postTriageHistory } from '@/lib/triage-api';

const FEEDBACK_API_URL =
  process.env.FEEDBACK_API_URL ||
  'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const FEEDBACK_API_KEY = process.env.FEEDBACK_API_KEY || '';

interface ApproveProposalBody {
  appId?: string;
  reviewerNotes?: string;
}

interface ProposalRevision {
  version?: number;
  prompt?: string;
  instruction?: string | null;
  createdAt?: string;
}

interface TriageProposalLike {
  themeId?: string;
  classification?: string;
  confidence?: number;
  suspectedRepo?: string;
  revisions?: ProposalRevision[];
  [key: string]: unknown;
}

export async function POST(
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

  let body: ApproveProposalBody;
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as ApproveProposalBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

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

    const revisions = proposal.revisions ?? [];
    const currentRevision = revisions[revisions.length - 1];
    if (!currentRevision?.prompt) {
      return NextResponse.json(
        { error: 'proposal has no prompt' },
        { status: 400 },
      );
    }

    const improvement = await createImprovementFromProposal(
      {
        repoName: proposal.suspectedRepo || session.appId,
        promptText: currentRevision.prompt,
        title: proposal.themeId || `feedback-${sessionId}`,
        source: `feedback:${sessionId}`,
        reviewerNotes: body.reviewerNotes,
      },
      token,
    );

    await postTriageHistory({
      sessionId,
      action: 'approved',
      themeId: proposal.themeId,
      reviewerEmail: user.email,
      reviewerNotes: body.reviewerNotes,
      improvementQueueItemId: improvement.promptId,
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
          reviewStatus: 'in_progress',
          triageProposal: null,
        }),
      },
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to patch session after approval',
          improvement,
          detail: errBody,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ improvement });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
