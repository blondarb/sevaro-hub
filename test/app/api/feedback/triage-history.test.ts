import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  fetchTriageHistory: vi.fn(),
  postTriageHistory: vi.fn(),
}));

import { GET, POST } from '@/app/api/feedback/triage-history/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { fetchTriageHistory, postTriageHistory } from '@/lib/triage-api';

function makeRequest(init?: RequestInit & { url?: string }) {
  const { url = 'http://localhost/api/feedback/triage-history', ...rest } = init || {};
  return new Request(url, {
    headers: { Cookie: 'id_token=valid' },
    ...rest,
  });
}

describe('GET /api/feedback/triage-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token present', async () => {
    vi.mocked(extractToken).mockReturnValue(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'user@example.com',
      sub: 'abc',
      isAdmin: false,
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
  });

  it('proxies to fetchTriageHistory with days query param', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(fetchTriageHistory).mockResolvedValue({
      entries: [
        {
          sessionId: 's1',
          timestamp: '2026-04-14T00:00:00Z',
          action: 'approved',
          themeId: 't1',
        },
      ],
    });

    const res = await GET(
      makeRequest({ url: 'http://localhost/api/feedback/triage-history?days=60' }),
    );

    expect(fetchTriageHistory).toHaveBeenCalledWith(60);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].sessionId).toBe('s1');
  });

  it('defaults to 30 days when no query param', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(fetchTriageHistory).mockResolvedValue({ entries: [] });

    await GET(makeRequest());

    expect(fetchTriageHistory).toHaveBeenCalledWith(30);
  });
});

describe('POST /api/feedback/triage-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token present', async () => {
    vi.mocked(extractToken).mockReturnValue(null);

    const res = await POST(
      makeRequest({
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', action: 'approved' }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it('forwards body plus reviewerEmail from verified user', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(postTriageHistory).mockResolvedValue({ ok: true });

    const res = await POST(
      makeRequest({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 's1',
          action: 'approved',
          themeId: 't1',
          reviewerNotes: 'looks good',
        }),
      }),
    );

    expect(postTriageHistory).toHaveBeenCalledWith({
      sessionId: 's1',
      action: 'approved',
      themeId: 't1',
      reviewerNotes: 'looks good',
      reviewerEmail: 'steve@sevaro.com',
    });
    expect(res.status).toBe(200);
  });
});
