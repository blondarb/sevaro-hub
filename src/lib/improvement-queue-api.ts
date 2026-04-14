const API_URL =
  process.env.NEXT_PUBLIC_IMPROVEMENT_QUEUE_API_URL ||
  'https://ael0orzmsk.execute-api.us-east-2.amazonaws.com';

export interface ImprovementEntry {
  repoName: string;
  promptId: string;
  title: string;
  priority: 'P1' | 'P2' | 'P3';
  status: 'pending' | 'in-progress' | 'completed' | 'deferred';
  estimatedScope?: 'small' | 'medium' | 'large';
  planFile?: string;
  promptFile?: string;
  promptText?: string;
  whatsNewEntry?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  createdBy?: string;
}

export async function getAllImprovements(
  token: string,
  filters?: { repoName?: string; priority?: string; status?: string },
): Promise<ImprovementEntry[]> {
  const params = new URLSearchParams();
  if (filters?.repoName) params.set('repoName', filters.repoName);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.status) params.set('status', filters.status);

  const qs = params.toString();
  const url = `${API_URL}/improvements${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch improvements: ${res.status}`);
  const data = await res.json();
  return data.improvements || [];
}

export async function createImprovement(
  entry: Omit<ImprovementEntry, 'createdAt' | 'updatedAt' | 'createdBy'>,
  token: string,
): Promise<ImprovementEntry> {
  const res = await fetch(`${API_URL}/improvements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create improvement: ${res.status}`);
  }
  const data = await res.json();
  return data.improvement;
}

export async function updateImprovement(
  repoName: string,
  promptId: string,
  updates: Partial<ImprovementEntry>,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/improvements`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ repoName, promptId, ...updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update improvement: ${res.status}`);
  }
}

export async function deleteImprovement(
  repoName: string,
  promptId: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/improvements`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ repoName, promptId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete improvement: ${res.status}`);
  }
}

/**
 * Input shape used when an approved triage proposal is promoted into the
 * improvement queue. This is a narrower surface than the full
 * {@link ImprovementEntry} — the route layer fills in sensible defaults for
 * priority/status and derives a stable promptId so callers don't have to know
 * the queue's internal schema.
 */
export interface ProposalApprovalInput {
  /** Repo the improvement targets (e.g. `sevaro-evidence-engine`). */
  repoName: string;
  /** Final Claude Code prompt text (already refined) to enqueue. */
  promptText: string;
  /** Short human-readable title — usually the proposal's themeId. */
  title: string;
  /** Provenance string, e.g. `feedback:<sessionId>`. Used to derive promptId. */
  source: string;
  /** Optional reviewer notes appended to promptText. */
  reviewerNotes?: string;
}

/**
 * Creates an improvement-queue entry from an approved triage proposal.
 *
 * Translates the proposal-centric {@link ProposalApprovalInput} shape into the
 * full {@link ImprovementEntry} expected by the improvement-queue Lambda,
 * defaulting priority to `P2` and status to `pending` so reviewers can edit in
 * `/admin/improvements` later. Reviewer notes are appended to `promptText` so
 * downstream automation sees them inline.
 *
 * The improvement-queue Lambda verifies Cognito JWTs via `aws-jwt-verify`, so
 * the caller must pass the user's id_token through as `token`.
 */
export async function createImprovementFromProposal(
  input: ProposalApprovalInput,
  token: string,
): Promise<ImprovementEntry> {
  const promptId = `${input.source.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`;
  const promptText = input.reviewerNotes
    ? `${input.promptText}\n\n---\nReviewer notes: ${input.reviewerNotes}`
    : input.promptText;

  return createImprovement(
    {
      repoName: input.repoName,
      promptId,
      title: input.title,
      priority: 'P2',
      status: 'pending',
      promptText,
    },
    token,
  );
}
