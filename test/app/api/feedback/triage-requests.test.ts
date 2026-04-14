import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({
  extractToken: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/triage-api', () => ({
  fetchPendingTriageRequests: vi.fn(),
  postTriageRequest: vi.fn(),
  patchTriageRequest: vi.fn(),
}));

import { GET, POST } from '@/app/api/feedback/triage-requests/route';
import { PATCH } from '@/app/api/feedback/triage-requests/[id]/route';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import {
  fetchPendingTriageRequests,
  postTriageRequest,
  patchTriageRequest,
} from '@/lib/triage-api';

function makeRequest(init?: RequestInit & { url?: string }) {
  const { url = 'http://localhost/api/feedback/triage-requests', ...rest } = init || {};
  return new Request(url, {
    headers: { Cookie: 'id_token=valid' },
    ...rest,
  });
}

describe('GET /api/feedback/triage-requests', () => {
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

  it('proxies to fetchPendingTriageRequests', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(fetchPendingTriageRequests).mockResolvedValue({
      requests: [
        {
          requestId: 'r1',
          status: 'pending',
          requestedBy: 'steve@sevaro.com',
          requestedAt: '2026-04-14T00:00:00Z',
          sessionIds: ['s1', 's2'],
        },
      ],
    });

    const res = await GET(makeRequest());

    expect(fetchPendingTriageRequests).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].requestId).toBe('r1');
  });
});

describe('POST /api/feedback/triage-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token present', async () => {
    vi.mocked(extractToken).mockReturnValue(null);

    const res = await POST(
      makeRequest({
        method: 'POST',
        body: JSON.stringify({ sessionIds: ['s1'] }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it('returns 400 when body is malformed JSON', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });

    const req = new Request('http://localhost/api/feedback/triage-requests', {
      method: 'POST',
      headers: {
        cookie: 'id_token=valid',
        'content-type': 'application/json',
      },
      body: 'not-json{',
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(postTriageRequest).not.toHaveBeenCalled();
  });

  it('calls postTriageRequest with user email and body sessionIds', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(postTriageRequest).mockResolvedValue({ requestId: 'new-id' });

    const res = await POST(
      makeRequest({
        method: 'POST',
        body: JSON.stringify({ sessionIds: ['s1', 's2'] }),
      }),
    );

    expect(postTriageRequest).toHaveBeenCalledWith('steve@sevaro.com', ['s1', 's2']);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe('new-id');
  });
});

describe('PATCH /api/feedback/triage-requests/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function patchRequest(body: unknown) {
    return new Request('http://localhost/api/feedback/triage-requests/r1', {
      method: 'PATCH',
      headers: { Cookie: 'id_token=valid' },
      body: JSON.stringify(body),
    });
  }

  it('returns 403 when user not admin', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'user@example.com',
      sub: 'abc',
      isAdmin: false,
    });

    const res = await PATCH(patchRequest({ status: 'done' }), {
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(res.status).toBe(403);
  });

  it('rejects invalid status values with 400', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });

    const res = await PATCH(patchRequest({ status: 'garbage' }), {
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(res.status).toBe(400);
    expect(patchTriageRequest).not.toHaveBeenCalled();
  });

  it('returns 400 when body is malformed JSON', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });

    const req = new Request('http://localhost/api/feedback/triage-requests/r1', {
      method: 'PATCH',
      headers: {
        cookie: 'id_token=valid',
        'content-type': 'application/json',
      },
      body: 'not-json{',
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(res.status).toBe(400);
    expect(patchTriageRequest).not.toHaveBeenCalled();
  });

  it('rejects negative processedCount with 400', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });

    const res = await PATCH(patchRequest({ processedCount: -1 }), {
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(res.status).toBe(400);
    expect(patchTriageRequest).not.toHaveBeenCalled();
  });

  it('rejects non-integer processedCount with 400', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });

    const res = await PATCH(patchRequest({ processedCount: 3.7 }), {
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(res.status).toBe(400);
    expect(patchTriageRequest).not.toHaveBeenCalled();
  });

  it('calls patchTriageRequest with id and valid updates', async () => {
    vi.mocked(extractToken).mockReturnValue('token');
    vi.mocked(verifyToken).mockResolvedValue({
      email: 'steve@sevaro.com',
      sub: 'abc',
      isAdmin: true,
    });
    vi.mocked(patchTriageRequest).mockResolvedValue({ ok: true });

    const res = await PATCH(
      patchRequest({ status: 'done', processedCount: 5 }),
      { params: Promise.resolve({ id: 'r1' }) },
    );

    expect(patchTriageRequest).toHaveBeenCalledWith('r1', {
      status: 'done',
      processedCount: 5,
    });
    expect(res.status).toBe(200);
  });
});
