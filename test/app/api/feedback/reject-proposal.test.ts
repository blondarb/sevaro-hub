import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/feedback-api', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  postTriageHistory: vi.fn(),
}));

import { DELETE } from '@/app/api/feedback/[id]/proposal/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
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
      version: 1,
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
      ],
    },
    ...overrides,
  };
}

function makeRequest(body: unknown, opts: { rawBody?: string; url?: string } = {}) {
  return new Request(
    opts.url ?? `http://localhost/api/feedback/${SESSION_ID}/proposal`,
    {
      method: 'DELETE',
      headers: {
        Cookie: 'id_token=valid',
        'content-type': 'application/json',
      },
      body: opts.rawBody ?? JSON.stringify(body),
    },
  );
}

describe('DELETE /api/feedback/[id]/proposal', () => {
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

    const res = await DELETE(makeRequest({ reason: 'low_priority', appId: APP_ID }), {
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

    const res = await DELETE(makeRequest({ reason: 'low_priority', appId: APP_ID }), {
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

    const res = await DELETE(makeRequest(null, { rawBody: 'not-json{' }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(postTriageHistory).not.toHaveBeenCalled();
  });

  it('returns 400 when reason is missing', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });

    const res = await DELETE(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(postTriageHistory).not.toHaveBeenCalled();
  });

  it('returns 400 when reason is not in VALID_REASONS', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });

    const res = await DELETE(makeRequest({ reason: 'bogus', appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(postTriageHistory).not.toHaveBeenCalled();
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

    const res = await DELETE(makeRequest({ reason: 'low_priority', appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(404);
    expect(postTriageHistory).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs rejection with reason+comment+themeId+snapshot and marks session dismissed', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res = await DELETE(
      makeRequest({ reason: 'low_priority', comment: 'not now', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    // History log includes rejected action + rejectionReason + rejectionComment + themeId + snapshot
    expect(postTriageHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        action: 'rejected',
        themeId: 'fonts-too-small',
        rejectionReason: 'low_priority',
        rejectionComment: 'not now',
        reviewerEmail: 'steve@sevaro.com',
        proposalSnapshot: expect.objectContaining({
          themeId: 'fonts-too-small',
        }),
      }),
    );

    // Session was patched via the feedback Lambda with dismissed + null proposal
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [patchUrl, patchInit] = fetchSpy.mock.calls[0];
    expect(patchUrl).toContain(`/sessions/${SESSION_ID}`);
    expect(patchUrl).toContain(`appId=${APP_ID}`);
    expect(patchInit.method).toBe('PATCH');
    const patchBody = JSON.parse(patchInit.body as string);
    expect(patchBody.reviewStatus).toBe('dismissed');
    expect(patchBody.triageProposal).toBeNull();
    expect(patchBody.resolvedBy).toBe('steve@sevaro.com');
    expect(patchBody.resolvedAt).toBeDefined();
  });

  it('accepts rejection without a comment field', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res = await DELETE(
      makeRequest({ reason: 'duplicate', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(200);
    expect(postTriageHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rejected',
        rejectionReason: 'duplicate',
      }),
    );
    // rejectionComment may be undefined — accept that
    const call = vi.mocked(postTriageHistory).mock.calls[0][0];
    expect(call.rejectionComment).toBeUndefined();
  });

  it('accepts appId from the query string when absent from the body', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const req = makeRequest(
      { reason: 'out_of_scope' },
      { url: `http://localhost/api/feedback/${SESSION_ID}/proposal?appId=${APP_ID}` },
    );

    const res = await DELETE(req, { params: Promise.resolve({ id: SESSION_ID }) });

    expect(res.status).toBe(200);
    expect(getSession).toHaveBeenCalledWith(SESSION_ID, APP_ID);
  });

  it('returns 500 when postTriageHistory throws', async () => {
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(postTriageHistory).mockRejectedValue(new Error('history down'));

    const res = await DELETE(
      makeRequest({ reason: 'low_priority', appId: APP_ID }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
