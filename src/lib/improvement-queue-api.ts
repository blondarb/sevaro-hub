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
