const API_URL = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';

export type ReviewStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface FeedbackSession {
  sessionId: string;
  appId: string;
  userId?: string;
  userLabel?: string;
  category: string;
  startedAt: string;
  duration: number;
  userAgent?: string;
  screenSize?: string;
  audioKey: string;
  audioUrl?: string;
  screenshots: string[];
  transcript?: string;
  aiSummary?: string;
  actionItems?: ActionItem[] | string;
  events: FeedbackEvent[] | string;
  status: string;
  reviewStatus?: ReviewStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FeedbackEvent {
  offsetMs: number;
  type: 'route' | 'click' | 'scroll' | 'custom' | 'screenshot';
  data: Record<string, unknown>;
}

export interface ActionItem {
  id: string;
  type: 'bug' | 'ux-issue' | 'feature-request' | 'content-fix';
  title: string;
  description: string;
  affectedApp: string;
  affectedPages: string[];
  affectedElements?: string[];
  userQuotes: string[];
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  status: 'new' | 'approved' | 'rejected' | 'compiled' | 'resolved';
}

export async function listSessions(appId?: string): Promise<FeedbackSession[]> {
  const params = appId ? `?appId=${encodeURIComponent(appId)}` : '';
  const res = await fetch(`${API_URL}/sessions${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  const data = await res.json();
  return (data.sessions || []).map(normalizeSession);
}

export async function getSession(sessionId: string, appId: string): Promise<FeedbackSession> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}?appId=${encodeURIComponent(appId)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return normalizeSession(await res.json());
}

function normalizeSession(session: FeedbackSession): FeedbackSession {
  if (typeof session.events === 'string') {
    session.events = JSON.parse(session.events);
  }
  if (typeof session.actionItems === 'string') {
    session.actionItems = JSON.parse(session.actionItems);
  }
  return session;
}

export function getAudioUrl(audioKey: string): string {
  return `https://sevaro-feedback-recordings.s3.us-east-2.amazonaws.com/${audioKey}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function formatTimestamp(offsetMs: number): string {
  const secs = Math.floor(offsetMs / 1000);
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

export function generateClaudeCodePrompt(
  targetApp: string,
  actionItems: ActionItem[],
  sessions: FeedbackSession[],
): string {
  const appPaths: Record<string, string> = {
    'evidence-engine': '/Users/stevearbogast/dev/repos/sevaro-evidence-engine/',
    'opsample': '/Users/stevearbogast/dev/repos/OPSAmplehtml/',
    'workouts': '/Users/stevearbogast/dev/repos/Workouts/',
    'showcase': '/Users/stevearbogast/dev/repos/github-showcase/',
  };

  const repoPath = appPaths[targetApp] || `/Users/stevearbogast/dev/repos/${targetApp}/`;
  const userCount = new Set(sessions.map((s) => s.userLabel || 'anonymous')).size;
  const dateRange = sessions.length > 0
    ? `${sessions[0].createdAt?.split('T')[0]} to ${sessions[sessions.length - 1].createdAt?.split('T')[0]}`
    : 'recent';

  const priorityGroups = {
    critical: actionItems.filter((i) => i.severity === 'critical'),
    major: actionItems.filter((i) => i.severity === 'major'),
    minor: actionItems.filter((i) => i.severity === 'minor'),
    cosmetic: actionItems.filter((i) => i.severity === 'cosmetic'),
  };

  let prompt = `You are working on the ${targetApp} app at ${repoPath}

Based on user feedback from ${userCount} tester${userCount > 1 ? 's' : ''} (collected ${dateRange}), make the following changes:\n\n`;

  let priorityNum = 1;
  for (const [severity, items] of Object.entries(priorityGroups)) {
    for (const item of items) {
      const typeLabel = item.type === 'bug' ? 'Bug Fix' : item.type === 'ux-issue' ? 'UX Improvement' : item.type === 'feature-request' ? 'Feature Request' : 'Content Fix';
      prompt += `## Priority ${priorityNum}: ${typeLabel}\n`;
      prompt += `**${item.title}** (${severity}${item.affectedPages.length > 0 ? `, reported on ${item.affectedPages.join(', ')}` : ''})\n`;
      if (item.affectedElements && item.affectedElements.length > 0) {
        prompt += `- Elements: ${item.affectedElements.join(', ')}\n`;
      }
      for (const quote of item.userQuotes) {
        prompt += `- User said: "${quote}"\n`;
      }
      prompt += `- ${item.description}\n\n`;
      priorityNum++;
    }
  }

  prompt += `Do NOT change unrelated functionality. Make targeted, surgical changes only.\n\n`;

  prompt += `## After completing all changes\n\n`;
  prompt += `### Step 1: Verify the fixes\n`;
  prompt += `Run the dev server and confirm each fix works correctly. Check for console errors, visual regressions, and that the reported behavior is resolved. If a fix doesn't work, iterate until it does.\n\n`;

  prompt += `### Step 2: Mark feedback as addressed\n`;
  prompt += `Update the action item statuses in the feedback system by running this curl command:\n\n`;
  prompt += '```bash\n';

  // Build the updated action items with status changed to "resolved"
  const resolvedItems = actionItems.map((item) => ({
    ...item,
    status: 'resolved',
  }));

  const sessionId = sessions[0]?.sessionId;
  const appId = sessions[0]?.appId;

  if (sessionId && appId) {
    prompt += `curl -s -X PUT "https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback/sessions/${sessionId}" \\\n`;
    prompt += `  -H "Content-Type: application/json" \\\n`;
    prompt += `  -d '${JSON.stringify({ appId, status: 'addressed', actionItems: resolvedItems })}'\n`;
  }

  prompt += '```\n\n';
  prompt += `This marks the session as "addressed" and all action items as "resolved" in the feedback dashboard so the team knows it has been handled.\n`;

  return prompt;
}
