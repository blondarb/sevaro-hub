import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/feedback-api', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/bedrock-refine', () => ({
  refinePrompt: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  postTriageHistory: vi.fn(),
}));

import { POST } from '@/app/api/feedback/[id]/refine-prompt/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { refinePrompt } from '@/lib/bedrock-refine';
import { postTriageHistory } from '@/lib/triage-api';

const SESSION_ID = 'a3f2';
const APP_ID = 'evidence-engine';

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION_ID,
    appId: APP_ID,
    category: 'bug',
    startedAt: '2026-04-14T09:00:00Z',
    duration: 42,
    audioKey: 'a.wav',
    screenshots: [],
    events: [],
    status: 'complete',
    createdAt: '2026-04-14T09:00:00Z',
    transcript: 'The fonts are way too small on the evidence results page.',
    triageProposal: {
      version: 1,
      themeId: 'fonts-too-small',
      classification: 'real_bug',
      confidence: 0.92,
      suspectedRepo: 'sevaro-evidence-engine',
      revisions: [
        {
          version: 1,
          prompt: 'original',
          instruction: null,
          createdAt: '2026-04-14T09:00:00Z',
        },
      ],
    },
    ...overrides,
  };
}

function makeRequest(body: unknown, opts: { rawBody?: string } = {}) {
  return new Request(
    `http://localhost/api/feedback/${SESSION_ID}/refine-prompt`,
    {
      method: 'POST',
      headers: {
        Cookie: 'id_token=valid',
        'content-type': 'application/json',
      },
      body: opts.rawBody ?? JSON.stringify(body),
    },
  );
}

describe('POST /api/feedback/[id]/refine-prompt', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updated: true }), { status: 200 }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no token present', async () => {
    vi.mocked(extractToken).mockReturnValue(null);

    const res = await POST(
      makeRequest({ instruction: 'also check contrast', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'user@example.com',
      isAdmin: false,
    });

    const res = await POST(
      makeRequest({ instruction: 'also check contrast', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 400 when body is malformed JSON', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });

    const res = await POST(makeRequest(null, { rawBody: 'not-json{' }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 400 when instruction is missing from body', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 400 when instruction is an empty string', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });

    const res = await POST(
      makeRequest({ instruction: '', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(400);
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 400 when instruction is not a string', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });

    const res = await POST(
      makeRequest({ instruction: 42, appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(400);
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 404 when session has no triageProposal', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(
      makeSession({ triageProposal: null }) as never,
    );

    const res = await POST(
      makeRequest({ instruction: 'also check contrast', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(404);
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('returns 400 when proposal has no revisions', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(
      makeSession({
        triageProposal: {
          version: 1,
          themeId: 'fonts-too-small',
          classification: 'real_bug',
          confidence: 0.92,
          suspectedRepo: 'sevaro-evidence-engine',
          revisions: [],
        },
      }) as never,
    );

    const res = await POST(
      makeRequest({ instruction: 'also check contrast', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(400);
    expect(refinePrompt).not.toHaveBeenCalled();
  });

  it('appends a new revision, logs history, patches session, and returns revised prompt', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(refinePrompt).mockResolvedValue({
      revisedPrompt: 'original + contrast check',
      changeSummary: 'added contrast check',
    });
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res = await POST(
      makeRequest({
        instruction: 'also check contrast',
        appId: APP_ID,
      }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revision).toBeDefined();
    expect(body.revision.version).toBe(2);
    expect(body.revision.prompt).toBe('original + contrast check');
    expect(body.revision.instruction).toBe('also check contrast');
    expect(typeof body.revision.createdAt).toBe('string');
    expect(body.changeSummary).toBe('added contrast check');

    // refinePrompt called with current prompt + instruction
    expect(refinePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPrompt: 'original',
        refinementInstruction: 'also check contrast',
        sessionContext: expect.objectContaining({
          classification: 'real_bug',
        }),
      }),
    );

    // postTriageHistory called with action=refined, snapshot has 2 revisions
    expect(postTriageHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        action: 'refined',
        themeId: 'fonts-too-small',
        reviewerEmail: 'steve@sevaro.com',
        reviewerNotes: 'also check contrast',
      }),
    );
    const historyCall = vi.mocked(postTriageHistory).mock.calls[0][0];
    const snapshot = historyCall.proposalSnapshot as {
      revisions: { version: number; prompt: string }[];
    };
    expect(snapshot.revisions).toHaveLength(2);
    expect(snapshot.revisions[1].version).toBe(2);
    expect(snapshot.revisions[1].prompt).toBe('original + contrast check');

    // Session was PATCHed with the updated proposal (2 revisions)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [patchUrl, patchInit] = fetchSpy.mock.calls[0];
    expect(patchUrl).toContain(`/sessions/${SESSION_ID}`);
    expect(patchUrl).toContain(`appId=${APP_ID}`);
    expect(patchInit.method).toBe('PATCH');
    const patchBody = JSON.parse(patchInit.body as string);
    expect(patchBody.appId).toBe(APP_ID);
    expect(patchBody.triageProposal.revisions).toHaveLength(2);
    expect(patchBody.triageProposal.revisions[1].prompt).toBe(
      'original + contrast check',
    );
    expect(patchBody.triageProposal.revisions[1].instruction).toBe(
      'also check contrast',
    );
  });

  it('accepts appId from the query string when absent from the body', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(refinePrompt).mockResolvedValue({
      revisedPrompt: 'r',
      changeSummary: 's',
    });
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const req = new Request(
      `http://localhost/api/feedback/${SESSION_ID}/refine-prompt?appId=${APP_ID}`,
      {
        method: 'POST',
        headers: {
          Cookie: 'id_token=valid',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ instruction: 'tweak' }),
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(200);
    expect(getSession).toHaveBeenCalledWith(SESSION_ID, APP_ID);
  });

  it('returns 500 when Bedrock refinePrompt throws', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(refinePrompt).mockRejectedValue(new Error('bedrock down'));

    const res = await POST(
      makeRequest({ instruction: 'tweak', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(500);
    expect(postTriageHistory).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
