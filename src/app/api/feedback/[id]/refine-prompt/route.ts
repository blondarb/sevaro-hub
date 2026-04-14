import { NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { refinePrompt } from '@/lib/bedrock-refine';
import { postTriageHistory } from '@/lib/triage-api';

const FEEDBACK_API_URL =
  process.env.FEEDBACK_API_URL ||
  'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const FEEDBACK_API_KEY = process.env.FEEDBACK_API_KEY || '';

interface RefineBody {
  instruction?: unknown;
  appId?: string;
}

interface ProposalRevision {
  version: number;
  prompt: string;
  instruction: string | null;
  createdAt: string;
}

interface TriageProposalLike {
  themeId?: string;
  classification?: string;
  confidence?: number;
  suspectedRepo?: string;
  revisions?: ProposalRevision[];
  [key: string]: unknown;
}

// TODO: feedback-api normalizeSession should parse triageProposal once the
// Lambda deploy with the parsing fix lands — this route assumes the object
// shape, matching Tasks 12 and 13.
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

  let body: RefineBody;
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as RefineBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.instruction !== 'string' || body.instruction.length === 0) {
    return NextResponse.json(
      { error: 'instruction required (non-empty string)' },
      { status: 400 },
    );
  }
  const instruction = body.instruction;

  const { searchParams } = new URL(request.url);
  const appId = body.appId || searchParams.get('appId') || '';

  try {
    const session = await getSession(sessionId, appId);
    const proposal = (
      session as unknown as { triageProposal?: TriageProposalLike | null }
    ).triageProposal;

    if (!proposal) {
      return NextResponse.json(
        { error: 'no triage proposal on session' },
        { status: 404 },
      );
    }

    const revisions = proposal.revisions ?? [];
    const current = revisions[revisions.length - 1];
    if (!current?.prompt) {
      return NextResponse.json(
        { error: 'proposal has no revisions' },
        { status: 400 },
      );
    }

    const transcript =
      (session as unknown as { transcript?: string }).transcript ?? '';
    const refined = await refinePrompt({
      currentPrompt: current.prompt,
      refinementInstruction: instruction,
      sessionContext: {
        classification: proposal.classification,
        excerpt: transcript.slice(0, 500),
      },
    });

    const newRevision: ProposalRevision = {
      version: current.version + 1,
      prompt: refined.revisedPrompt,
      instruction,
      createdAt: new Date().toISOString(),
    };

    const updatedProposal: TriageProposalLike = {
      ...proposal,
      revisions: [...revisions, newRevision],
    };

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
          triageProposal: updatedProposal,
        }),
      },
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to patch session with refined proposal',
          detail: errBody,
        },
        { status: 500 },
      );
    }

    await postTriageHistory({
      sessionId,
      action: 'refined',
      themeId: proposal.themeId,
      reviewerEmail: user.email,
      reviewerNotes: instruction,
      proposalSnapshot: updatedProposal as Record<string, unknown>,
    });

    return NextResponse.json({
      revision: newRevision,
      changeSummary: refined.changeSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
