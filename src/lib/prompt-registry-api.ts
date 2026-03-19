const API_URL =
  process.env.NEXT_PUBLIC_PROMPT_REGISTRY_API_URL ||
  'https://17i1ny0ma9.execute-api.us-east-2.amazonaws.com';

export interface PromptEntry {
  appName: string;
  promptId: string;
  title: string;
  category: 'system-prompt' | 'improvement' | 'fix' | 'feature';
  status: 'draft' | 'active' | 'deployed' | 'archived';
  feature: string;
  promptText: string;
  currentVersion: number;
  sourceFile?: string;
  aiSummary?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface PromptFeedback {
  promptKey: string;
  feedbackId: string;
  feedbackText: string;
  feedbackType: 'text' | 'voice-transcript';
  refinedPromptText?: string;
  changeSummary?: string;
  refinementStatus: 'pending' | 'refined' | 'approved' | 'rejected';
  createdAt?: string;
  createdBy?: string;
}

export async function getAllPrompts(
  token: string,
  filters?: { appName?: string; category?: string; status?: string },
): Promise<PromptEntry[]> {
  const params = new URLSearchParams();
  if (filters?.appName) params.set('appName', filters.appName);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.status) params.set('status', filters.status);

  const qs = params.toString();
  const url = `${API_URL}/prompts${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.status}`);
  const data = await res.json();
  return data.prompts || [];
}

export async function createPrompt(
  entry: Omit<PromptEntry, 'currentVersion' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  token: string,
): Promise<PromptEntry> {
  const res = await fetch(`${API_URL}/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create prompt: ${res.status}`);
  }
  const data = await res.json();
  return data.prompt;
}

export async function updatePrompt(
  appName: string,
  promptId: string,
  updates: Partial<PromptEntry>,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/prompts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ appName, promptId, ...updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update prompt: ${res.status}`);
  }
}

export async function deletePrompt(
  appName: string,
  promptId: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/prompts`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ appName, promptId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete prompt: ${res.status}`);
  }
}

export async function getPromptFeedback(
  promptKey: string,
  token: string,
): Promise<PromptFeedback[]> {
  const url = `${API_URL}/prompts/feedback?promptKey=${encodeURIComponent(promptKey)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch feedback: ${res.status}`);
  const data = await res.json();
  return data.feedback || [];
}

export async function addPromptFeedback(
  promptKey: string,
  feedbackText: string,
  token: string,
  feedbackType: 'text' | 'voice-transcript' = 'text',
): Promise<PromptFeedback> {
  const res = await fetch(`${API_URL}/prompts/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ promptKey, feedbackText, feedbackType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to add feedback: ${res.status}`);
  }
  const data = await res.json();
  return data.feedback;
}

export async function updateFeedback(
  promptKey: string,
  feedbackId: string,
  updates: Partial<PromptFeedback>,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/prompts/feedback`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ promptKey, feedbackId, ...updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update feedback: ${res.status}`);
  }
}
