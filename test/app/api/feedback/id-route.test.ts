import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/feedback-api', async (importOriginal) => {
  // Preserve the real toSessionDetailDTO / toAnnotationDTO / derivePathname
  // helpers (they're pure and exported from the same module). Mock only
  // the network-touching getSession.
  const actual = await importOriginal<typeof import('@/lib/feedback-api')>();
  return { ...actual, getSession: vi.fn() };
});

import { PATCH } from '@/app/api/feedback/[id]/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';

const SESSION_ID = 'sess-42';
const APP_ID = 'evidence-engine';

function makePatch(body: unknown, qs = '') {
  return new Request(
    `http://localhost/api/feedback/${SESSION_ID}${qs}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: 'id_token=valid',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
}

function mockPriorStatus(status: string | undefined) {
  vi.mocked(getSession).mockResolvedValue({
    sessionId: SESSION_ID,
    appId: APP_ID,
    category: 'bug',
    startedAt: '2026-04-14T09:00:00Z',
    duration: 0,
    audioKey: '',
    screenshots: [],
    events: [],
    status: 'summarized',
    createdAt: '2026-04-14T09:00:00Z',
    reviewStatus: status as never,
  } as never);
}

describe('PATCH /api/feedback/[id]', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    mockPriorStatus('open');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT set resolvedBy when body omits reviewStatus (e.g. triage writes triageProposal only)', async () => {
    const body = {
      appId: APP_ID,
      triageProposal: { version: 1, themeId: 't' },
    };
    const res = await PATCH(makePatch(body, `?appId=${APP_ID}`), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBeUndefined();
    expect(sent.resolvedAt).toBeUndefined();
    expect(sent.triageProposal).toEqual({ version: 1, themeId: 't' });
    // No reviewStatus => no need to fetch the prior session
    expect(getSession).not.toHaveBeenCalled();
  });

  it('does NOT set resolvedBy when reviewStatus is open / in_progress / dismissed (from non-resolved prior)', async () => {
    for (const status of ['open', 'in_progress', 'dismissed'] as const) {
      fetchSpy.mockClear();
      mockPriorStatus('open');
      await PATCH(makePatch({ appId: APP_ID, reviewStatus: status }, `?appId=${APP_ID}`), {
        params: Promise.resolve({ id: SESSION_ID }),
      });
      const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(sent.resolvedBy, `status=${status}`).toBeUndefined();
      expect(sent.resolvedAt, `status=${status}`).toBeUndefined();
    }
  });

  it('stamps resolvedBy AND resolvedAt from the verified JWT on a real resolve transition', async () => {
    mockPriorStatus('open');
    const before = Date.now();
    await PATCH(
      makePatch({ appId: APP_ID, reviewStatus: 'resolved' }, `?appId=${APP_ID}`),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const after = Date.now();
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBe('steve@sevaro.com');
    expect(typeof sent.resolvedAt).toBe('string');
    const stampedMs = Date.parse(sent.resolvedAt);
    expect(stampedMs).toBeGreaterThanOrEqual(before);
    expect(stampedMs).toBeLessThanOrEqual(after);
  });

  it('does NOT re-stamp resolvedBy when prior state is already resolved (no real transition)', async () => {
    mockPriorStatus('resolved');
    await PATCH(
      makePatch(
        { appId: APP_ID, reviewStatus: 'resolved', resolutionNote: 'updated note' },
        `?appId=${APP_ID}`,
      ),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBeUndefined();
    expect(sent.resolvedAt).toBeUndefined();
    expect(sent.resolutionNote).toBe('updated note');
  });

  it('IGNORES a caller-supplied resolvedBy override — client cannot forge audit trail', async () => {
    mockPriorStatus('open');
    await PATCH(
      makePatch(
        { appId: APP_ID, reviewStatus: 'resolved', resolvedBy: 'attacker@evil.com' },
        `?appId=${APP_ID}`,
      ),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    // Server-stamped value from JWT wins — client value is dropped.
    expect(sent.resolvedBy).toBe('steve@sevaro.com');
    expect(sent.resolvedBy).not.toBe('attacker@evil.com');
  });

  it('IGNORES a caller-supplied resolvedAt override', async () => {
    mockPriorStatus('open');
    await PATCH(
      makePatch(
        {
          appId: APP_ID,
          reviewStatus: 'resolved',
          resolvedAt: '1999-01-01T00:00:00Z',
        },
        `?appId=${APP_ID}`,
      ),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedAt).not.toBe('1999-01-01T00:00:00Z');
    expect(Date.parse(sent.resolvedAt)).toBeGreaterThan(Date.parse('2020-01-01T00:00:00Z'));
  });

  it('STRIPS resolvedBy/resolvedAt from non-resolve PATCHes (pure spoof attempt)', async () => {
    mockPriorStatus('open');
    await PATCH(
      makePatch(
        {
          appId: APP_ID,
          // Attacker tries to stamp audit fields without any real status
          // change — reviewStatus omitted entirely.
          resolvedBy: 'attacker@evil.com',
          resolvedAt: '1999-01-01T00:00:00Z',
          resolutionNote: 'hi',
        },
        `?appId=${APP_ID}`,
      ),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBeUndefined();
    expect(sent.resolvedAt).toBeUndefined();
    // The legitimate note write still passes through.
    expect(sent.resolutionNote).toBe('hi');
  });

  it('CLEARS resolvedBy/resolvedAt/resolutionNote when moving away from resolved (so re-resolve gets a fresh stamp)', async () => {
    mockPriorStatus('resolved');
    await PATCH(
      makePatch({ appId: APP_ID, reviewStatus: 'open' }, `?appId=${APP_ID}`),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    // Lambda interprets null as REMOVE for these attributes.
    expect(sent.resolvedBy).toBeNull();
    expect(sent.resolvedAt).toBeNull();
    expect(sent.resolutionNote).toBeNull();
    expect(sent.reviewStatus).toBe('open');
  });

  it('returns 401 without a token', async () => {
    vi.mocked(extractToken).mockReturnValue(null);
    const res = await PATCH(makePatch({ appId: APP_ID }, `?appId=${APP_ID}`), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 403 without admin', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'abc',
      email: 'user@example.com',
      isAdmin: false,
    });
    const res = await PATCH(makePatch({ appId: APP_ID }, `?appId=${APP_ID}`), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still stamps from JWT when prior-state lookup transiently fails — JWT is the source of truth', async () => {
    // If the prior-state fetch fails, we treat the safer default as "stamp
    // from JWT". The alternative (proceed with no resolvedBy) leaves the
    // resolved session without an auditable owner. Forgery is still
    // impossible because the value comes from the verified JWT, not the
    // client body.
    vi.mocked(getSession).mockRejectedValue(new Error('transient network'));
    await PATCH(
      makePatch(
        { appId: APP_ID, reviewStatus: 'resolved', resolvedBy: 'attacker@evil.com' },
        `?appId=${APP_ID}`,
      ),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBe('steve@sevaro.com');
    expect(typeof sent.resolvedAt).toBe('string');
  });
});
