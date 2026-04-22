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

function makeImprovement(overrides: Record<string, unknown> = {}) {
  return {
    repoName: 'sevaro-evidence-engine',
    promptId: 'improvement-a3f2-v2',
    title: 'fonts-too-small',
    priority: 'P2' as const,
    status: 'pending' as const,
    promptText: 'refined prompt',
    createdAt: '2026-04-14T09:30:00Z',
    ...overrides,
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
    // Stable, version-based promptId (atomicity fix Codex 2026-04-21 M#4)
    expect(body.improvement.promptId).toBe('improvement-a3f2-v2');

    // Uses the LATEST (v2) revision prompt, not v1, and the stable
    // sessionId/proposalVersion key rather than a time-based source string.
    expect(createImprovementFromProposal).toHaveBeenCalledWith(
      {
        repoName: 'sevaro-evidence-engine',
        promptText: 'refined prompt',
        title: 'fonts-too-small',
        sessionId: SESSION_ID,
        proposalVersion: 2,
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
        improvementQueueItemId: 'improvement-a3f2-v2',
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

  it('runs the three downstream-first steps in order: queue → history → session PATCH', async () => {
    // Codex R2 H#2: the source of truth (session.triageProposal) is cleared
    // LAST. If the queue write fails, nothing is committed and a retry is a
    // clean no-op. If the history write fails, a retry is safe because the
    // queue upsert is idempotent on the stable promptId. Only the final PATCH
    // mutates the session, so losing "prior art" on a retry is impossible.
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);

    const callOrder: string[] = [];
    vi.mocked(createImprovementFromProposal).mockImplementation(async () => {
      callOrder.push('queue');
      return makeImprovement() as never;
    });
    vi.mocked(postTriageHistory).mockImplementation(async () => {
      callOrder.push('history');
      return { ok: true };
    });
    fetchSpy.mockImplementation(async () => {
      callOrder.push('patch');
      return new Response(JSON.stringify({ updated: true }), { status: 200 });
    });

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(200);
    expect(callOrder).toEqual(['queue', 'history', 'patch']);
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
        sessionId: SESSION_ID,
        proposalVersion: 1,
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

  it('returns 500 when createImprovementFromProposal throws — NOTHING committed, clean retry', async () => {
    // Codex R2 H#2: queue is step 1. If it fails, history and PATCH have not
    // run, so no state has mutated — the proposal is still on the session for
    // a clean retry.
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
    // PATCH must NOT have run — the source of truth (triageProposal) is
    // still on the session for a clean retry.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 500 when postTriageHistory throws — queue already upserted, session NOT yet patched', async () => {
    // Codex R2 H#2: if history fails after a successful queue write, the
    // retry is still safe. The queue's stable promptId makes step 1 a no-op
    // upsert on replay; step 2 may append a duplicate audit entry (acceptable
    // — paper trail shows the retry); step 3 only runs on the successful
    // retry, so the triageProposal is preserved for re-reading in the
    // meantime.
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
    vi.mocked(postTriageHistory).mockRejectedValue(new Error('history down'));

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(500);
    expect(createImprovementFromProposal).toHaveBeenCalledTimes(1);
    // Session PATCH must NOT have run — triageProposal still intact for retry.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 500 when session PATCH fails — queue + history ran, but retry reconverges', async () => {
    // Codex R2 H#2: PATCH is step 3, the source-of-truth mutation. If it
    // fails, a retry re-runs step 1 (no-op upsert via stable promptId) +
    // step 2 (duplicate audit entry — tolerable) + step 3 (eventual success).
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
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'dynamo throttle' }), { status: 500 }),
    );

    const res = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(500);
    expect(createImprovementFromProposal).toHaveBeenCalledTimes(1);
    expect(postTriageHistory).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retry after transient queue failure produces exactly ONE queue entry with the expected stable promptId', async () => {
    // Simulates the Codex M#4 flake scenario under the R2 H#2 reordering:
    //   1st POST: queue fails first-thing (timeout). Nothing mutated.
    //   2nd POST (retry): queue succeeds with stable promptId, history +
    //                     PATCH run. Source of truth safely advances once.
    // After both calls there is exactly ONE queue entry because promptId is
    // derived from (sessionId, proposalVersion) and the queue Lambda upserts
    // via PutCommand.
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);

    // 1st call: queue throws
    vi.mocked(createImprovementFromProposal).mockRejectedValueOnce(
      new Error('queue timeout'),
    );
    // 2nd call: queue succeeds — returns the same stable promptId the 1st
    // call would have used, because the key is derived from the inputs.
    vi.mocked(createImprovementFromProposal).mockResolvedValueOnce(
      makeImprovement({ promptId: 'improvement-a3f2-v2' }) as never,
    );
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res1 = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res1.status).toBe(500);

    const res2 = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res2.status).toBe(200);

    // Both calls used the SAME stable promptId derived from sessionId + v2.
    expect(createImprovementFromProposal).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(createImprovementFromProposal).mock.calls) {
      const [input] = call;
      expect(input.sessionId).toBe(SESSION_ID);
      expect(input.proposalVersion).toBe(2);
    }

    // History only runs on the successful second call — the first run's
    // queue failure short-circuited before history.
    expect(postTriageHistory).toHaveBeenCalledTimes(1);
    const historyCall = vi.mocked(postTriageHistory).mock.calls[0][0];
    expect(historyCall.improvementQueueItemId).toBe('improvement-a3f2-v2');
  });

  it('retry after history failure produces one queue entry (stable) and preserves triageProposal between retries', async () => {
    // Codex R2 H#2 acceptance: history fails on first call after queue
    // succeeds; session PATCH has NOT yet run, so triageProposal is still
    // intact. On retry, queue is an idempotent upsert (single entry),
    // history may duplicate (acceptable audit), PATCH succeeds at last.
    vi.mocked(extractToken).mockReturnValue('user-token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(getSession).mockResolvedValue(makeSession() as never);
    vi.mocked(createImprovementFromProposal).mockResolvedValue(
      makeImprovement({ promptId: 'improvement-a3f2-v2' }) as never,
    );
    // 1st call: history throws. 2nd call: history succeeds.
    vi.mocked(postTriageHistory).mockRejectedValueOnce(new Error('history down'));
    vi.mocked(postTriageHistory).mockResolvedValueOnce({ ok: true });

    const res1 = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res1.status).toBe(500);
    // After 1st call: session PATCH never ran, so triageProposal is intact.
    expect(fetchSpy).not.toHaveBeenCalled();

    const res2 = await POST(makeRequest({ appId: APP_ID }), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res2.status).toBe(200);

    // Queue called twice but both with the SAME stable key → single row.
    expect(createImprovementFromProposal).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(createImprovementFromProposal).mock.calls) {
      expect(call[0].proposalVersion).toBe(2);
      expect(call[0].sessionId).toBe(SESSION_ID);
    }
    // Exactly one PATCH total — on the successful second call.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
