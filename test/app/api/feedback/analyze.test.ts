import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  fetchTriageHistory: vi.fn(),
}));

import { GET } from '@/app/api/feedback/analyze/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { fetchTriageHistory } from '@/lib/triage-api';

function makeRequest(url = 'http://localhost/api/feedback/analyze') {
  return new Request(url, { headers: { Cookie: 'id_token=valid' } });
}

describe('GET /api/feedback/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token', async () => {
    vi.mocked(extractToken).mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 's',
      email: 'x@y.com',
      isAdmin: false,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('groups history entries by themeId with counts and re-surface flag', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 's',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(fetchTriageHistory).mockResolvedValue({
      entries: [
        {
          sessionId: 's1',
          themeId: 'fonts-too-small',
          action: 'rejected',
          timestamp: '2026-04-02T00:00:00Z',
          proposalSnapshot: { themeDescription: 'Fonts small' },
        },
        {
          sessionId: 's2',
          themeId: 'fonts-too-small',
          action: 'proposed',
          timestamp: '2026-04-05T00:00:00Z',
          proposalSnapshot: { themeDescription: 'Fonts small' },
        },
        {
          sessionId: 's3',
          themeId: 'fonts-too-small',
          action: 'proposed',
          timestamp: '2026-04-14T00:00:00Z',
          proposalSnapshot: { themeDescription: 'Fonts small' },
        },
        {
          sessionId: 's4',
          themeId: 'login-auth-expired',
          action: 'approved',
          timestamp: '2026-04-10T00:00:00Z',
          proposalSnapshot: { themeDescription: 'Auth expires' },
        },
      ],
    });

    const res = await GET(makeRequest('http://localhost/api/feedback/analyze?days=30'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.stats.totalThemes).toBe(2);
    const fonts = body.themes.find(
      (t: { themeId: string }) => t.themeId === 'fonts-too-small',
    );
    expect(fonts).toBeDefined();
    expect(fonts.statusBreakdown).toEqual({ approved: 0, open: 2, rejected: 1 });
    // 2 proposed entries appear after the 2026-04-02 rejection
    expect(fonts.newVotesSinceDenial).toBe(2);
  });

  it('sorts themes by voteCount descending', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 's',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(fetchTriageHistory).mockResolvedValue({
      entries: [
        {
          sessionId: 'a1',
          themeId: 'theme-a',
          action: 'proposed',
          timestamp: '2026-04-10T00:00:00Z',
          proposalSnapshot: { themeDescription: 'A' },
        },
        {
          sessionId: 'b1',
          themeId: 'theme-b',
          action: 'proposed',
          timestamp: '2026-04-11T00:00:00Z',
          proposalSnapshot: { themeDescription: 'B' },
        },
        {
          sessionId: 'b2',
          themeId: 'theme-b',
          action: 'proposed',
          timestamp: '2026-04-12T00:00:00Z',
          proposalSnapshot: { themeDescription: 'B' },
        },
        {
          sessionId: 'b3',
          themeId: 'theme-b',
          action: 'approved',
          timestamp: '2026-04-13T00:00:00Z',
          proposalSnapshot: { themeDescription: 'B' },
        },
      ],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.themes[0].themeId).toBe('theme-b');
    expect(body.themes[1].themeId).toBe('theme-a');
  });

  it('defaults days to 30 when not provided', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 's',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(fetchTriageHistory).mockResolvedValue({ entries: [] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(fetchTriageHistory).toHaveBeenCalledWith(30);
  });

  it('returns 500 when triage-api throws', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 's',
      email: 'steve@sevaro.com',
      isAdmin: true,
    });
    vi.mocked(fetchTriageHistory).mockRejectedValue(new Error('lambda down'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
