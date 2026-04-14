const API_URL = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const API_KEY = process.env.FEEDBACK_API_KEY || '';

const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
});

export type TriageHistoryAction =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'refined'
  | 'reverted';

export interface TriageHistoryEntry {
  sessionId: string;
  timestamp: string;
  action: TriageHistoryAction;
  themeId?: string;
  reviewerEmail?: string;
  reviewerNotes?: string;
  rejectionReason?: string;
  rejectionComment?: string;
  improvementQueueItemId?: string;
  proposalSnapshot?: Record<string, unknown>;
}

export type TriageRequestStatus =
  | 'pending'
  | 'processing'
  | 'done'
  | 'failed'
  | 'expired';

export interface TriageRequest {
  requestId: string;
  status: TriageRequestStatus;
  requestedBy: string;
  requestedAt: string;
  sessionIds: string[];
  processedCount?: number;
  ttl?: number;
}

export interface Theme {
  themeId: string;
  description: string;
  count: number;
}

export async function fetchTriageHistory(
  days = 30,
): Promise<{ entries: TriageHistoryEntry[] }> {
  const res = await fetch(`${API_URL}/triage-history?days=${days}`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`triage-history GET ${res.status}`);
  return res.json();
}

export async function postTriageHistory(
  entry: Omit<TriageHistoryEntry, 'timestamp'>,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/triage-history`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`triage-history POST ${res.status}`);
  return res.json();
}

export async function fetchPendingTriageRequests(): Promise<{ requests: TriageRequest[] }> {
  const res = await fetch(`${API_URL}/triage-requests?status=pending`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`triage-requests GET ${res.status}`);
  return res.json();
}

export async function postTriageRequest(
  requestedBy: string,
  sessionIds: string[],
): Promise<{ requestId: string }> {
  const res = await fetch(`${API_URL}/triage-requests`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ requestedBy, sessionIds }),
  });
  if (!res.ok) throw new Error(`triage-requests POST ${res.status}`);
  return res.json();
}

export async function patchTriageRequest(
  requestId: string,
  updates: { status?: TriageRequestStatus; processedCount?: number },
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/triage-requests/${requestId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`triage-requests PATCH ${res.status}`);
  return res.json();
}

export async function fetchThemes(): Promise<{ themes: Theme[] }> {
  const res = await fetch(`${API_URL}/themes`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`themes GET ${res.status}`);
  return res.json();
}
