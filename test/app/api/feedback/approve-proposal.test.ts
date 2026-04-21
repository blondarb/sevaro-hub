import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/feedback-api', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/improvement-queue-api', () => ({
  createImprovementFromProposal: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  postTriageHistory: vi.fn(),
}));

import { POST } from '@/app/api/feedback/[id]/approve-proposal/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { createImprovementFromProposal } from '@/lib/improvement-queue-api';
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
    triageProposal: {
      version: 2,
      themeId: 'fonts-too-small',
      classification: 'real_bug',
      confidence: 0.92,
      suspectedRepo: 'sevaro-evidence-engine',
      revisions: [
        {
          version: 1,
          prompt: 'original prompt',
          instruction: null,
          createdAt: '2026-04-14T09:00:00Z',
        },
        {
          version: 2,
          prompt: 'refined prompt',
          instruction: 'add tests',
          createdAt: '2026-04-14T09:15:00Z',
        },
      ],
    },
    ...overrides,
  };
}

function makeImprovement() {
  return {
    repoName: 'sevaro-evidence-engine',
    promptId: 'feedback-a3f2-1234567890',
    title: 'fonts-too-small',
    priority: 'P2' as const,
    status: 'pending' as const,
    promptText: 'refined prompt',
    createdAt: '2026-04-14T09:30:00Z',
  };
}

function makeRequest(body: unknown, opts: { rawBody?: string } = {}) {
  return new Request(
    `http://localhost/api/feedback/${SESSION_ID}/approve-proposal`,
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

describe('POST /api/feedback/[id]/approve-proposal', () => {
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

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'user@example.com',
      isAdmin: false,
    });

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
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
    expect(createImprovementFromProposal).not.toHaveBeenCalled();
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

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(404);
    expect(createImprovementFromProposal).not.toHaveBeenCalled();
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

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(createImprovementFromProposal).not.toHaveBeenCalled();
  });

  it('returns 400 when latest revision has no prompt', async () => {
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
          revisions: [
            {
              version: 1,
              prompt: '',
              instruction: null,
              createdAt: '2026-04-14T09:00:00Z',
            },
          ],
        },
      }) as never,
    );

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(createImprovementFromProposal).not.toHaveBeenCalled();
  });

  it('writes to improvement queue with LATEST revision prompt, logs history, and patches session', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(createImprovementFromProposal).mockResolvedValue(
      makeImprovement() as never,
    );
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res = await POST(makeRequest({ appId: APP_ID, reviewerNotes: 'lgtm' }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.improvement).toBeDefined();
    expect(body.improvement.promptId).toBe('feedback-a3f2-1234567890');

    // Uses the LATEST (v2) revision prompt, not v1
    expect(createImprovementFromProposal).toHaveBeenCalledWith(
      {
        repoName: 'sevaro-evidence-engine',
        promptText: 'refined prompt',
        title: 'fonts-too-small',
        source: `feedback:${SESSION_ID}`,
        reviewerNotes: 'lgtm',
      },
      'user-token',
    );

    // History log includes the approved action + improvement reference
    expect(postTriageHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        action: 'approved',
        themeId: 'fonts-too-small',
        improvementQueueItemId: 'feedback-a3f2-1234567890',
        reviewerNotes: 'lgtm',
        reviewerEmail: 'steve@sevaro.com',
      }),
    );

    // Approval moves session to in_progress (fix is queued, not shipped).
    // Resolution only happens when the fix actually lands — a separate
    // manual step on the session detail page.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [patchUrl, patchInit] = fetchSpy.mock.calls[0];
    expect(patchUrl).toContain(`/sessions/${SESSION_ID}`);
    expect(patchUrl).toContain(`appId=${APP_ID}`);
    expect(patchInit.method).toBe('PATCH');
    const patchBody = JSON.parse(patchInit.body as string);
    expect(patchBody.reviewStatus).toBe('in_progress');
    expect(patchBody.resolvedBy).toBeUndefined();
    expect(patchBody.resolvedAt).toBeUndefined();
    expect(patchBody.triageProposal).toBeNull();
  });

  it('falls back to session.appId as repoName when suspectedRepo is missing', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
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
          suspectedRepo: undefined,
          revisions: [
            {
              version: 1,
              prompt: 'only prompt',
              instruction: null,
              createdAt: '2026-04-14T09:00:00Z',
            },
          ],
        },
      }) as never,
    );
    vi.mocked(createImprovementFromProposal).mockResolvedValue(
      makeImprovement() as never,
    );
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(200);
    expect(createImprovementFromProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        repoName: APP_ID,
        promptText: 'only prompt',
      }),
      'user-token',
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
    vi.mocked(createImprovementFromProposal).mockResolvedValue(
      makeImprovement() as never,
    );
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const req = new Request(
      `http://localhost/api/feedback/${SESSION_ID}/approve-proposal?appId=${APP_ID}`,
      {
        method: 'POST',
        headers: {
          Cookie: 'id_token=valid',
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );

    const res = await POST(req, { params: Promise.resolve({ id: SESSION_ID }) });

    expect(res.status).toBe(200);
    expect(getSession).toHaveBeenCalledWith(SESSION_ID, APP_ID);
  });

  it('returns 500 when createImprovementFromProposal throws', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(createImprovementFromProposal).mockRejectedValue(
      new Error('queue down'),
    );

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(500);
    expect(postTriageHistory).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
