import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

import { PATCH } from '@/app/api/feedback/[id]/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';

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
    expect(sent.triageProposal).toEqual({ version: 1, themeId: 't' });
  });

  it('does NOT set resolvedBy when reviewStatus is open / in_progress / dismissed', async () => {
    for (const status of ['open', 'in_progress', 'dismissed'] as const) {
      fetchSpy.mockClear();
      await PATCH(makePatch({ appId: APP_ID, reviewStatus: status }, `?appId=${APP_ID}`), {
        params: Promise.resolve({ id: SESSION_ID }),
      });
      const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(sent.resolvedBy, `status=${status}`).toBeUndefined();
    }
  });

  it('sets resolvedBy to the verified user email when reviewStatus flips to resolved', async () => {
    await PATCH(
      makePatch({ appId: APP_ID, reviewStatus: 'resolved' }, `?appId=${APP_ID}`),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBe('steve@sevaro.com');
  });

  it('respects a caller-supplied resolvedBy override when present', async () => {
    await PATCH(
      makePatch(
        { appId: APP_ID, reviewStatus: 'resolved', resolvedBy: 'other@sevaro.com' },
        `?appId=${APP_ID}`,
      ),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sent.resolvedBy).toBe('other@sevaro.com');
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
});
