const API_URL =
  process.env.NEXT_PUBLIC_WHATS_NEW_API_URL ||
  'https://5168ofhh8k.execute-api.us-east-2.amazonaws.com';

export interface WhatsNewEntry {
  appId: string;
  timestamp: string;
  title: string;
  description: string;
  category: 'fix' | 'feature' | 'improvement';
  version?: string;
  link?: string;
  createdBy?: string;
  createdAt?: string;
}

export async function getUpdates(
  appId: string,
  since?: string,
): Promise<WhatsNewEntry[]> {
  const params = new URLSearchParams({ appId });
  if (since) params.set('since', since);
  const res = await fetch(`${API_URL}/whats-new?${params}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch updates: ${res.status}`);
  const data = await res.json();
  return data.updates || [];
}

export async function getAllUpdates(): Promise<WhatsNewEntry[]> {
  const res = await fetch(`${API_URL}/whats-new/all`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch all updates: ${res.status}`);
  const data = await res.json();
  return data.updates || [];
}

export async function createUpdate(
  entry: Omit<WhatsNewEntry, 'timestamp' | 'createdBy' | 'createdAt'>,
  token: string,
): Promise<WhatsNewEntry> {
  const res = await fetch(`${API_URL}/whats-new`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create update: ${res.status}`);
  }
  const data = await res.json();
  return data.update;
}

export async function deleteUpdate(
  appId: string,
  timestamp: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/whats-new`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ appId, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete update: ${res.status}`);
  }
}
