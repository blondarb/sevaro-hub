import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  fetchThemes: vi.fn(),
}));

import { GET } from '@/app/api/feedback/themes/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { fetchThemes } from '@/lib/triage-api';

function makeRequest() {
  return new Request('http://localhost/api/feedback/themes', {
    headers: { Cookie: 'id_token=valid' },
  });
}

describe('GET /api/feedback/themes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token present', async () => {
    vi.mocked(extractToken).mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user not admin', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'user@example.com',
      sub: 'abc',
      isAdmin: false,
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
  });

  it('proxies to fetchThemes', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(fetchThemes).mockResolvedValue({
      themes: [
        { themeId: 't1', description: 'UX issues', count: 3 },
      ],
    });

    const res = await GET(makeRequest());

    expect(fetchThemes).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.themes).toHaveLength(1);
    expect(body.themes[0].themeId).toBe('t1');
  });
});
