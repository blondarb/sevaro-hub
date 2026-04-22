const API_URL = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const API_KEY = process.env.FEEDBACK_API_KEY || '';

export type ReviewStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  type: 'annotation' | 'voice-transcript';
  key?: string;
  url?: string;
  annotation?: ScreenshotAnnotation;
}

export interface ScreenshotAnnotation {
  screenshotKey?: string;
  screenshotUrl?: string;
  coordinates: { x: number; y: number };
  elementInfo: {
    selector: string;
    tag: string;
    className?: string;
    testId?: string;
    dataTour?: string;
    role?: string;
  };
  userComment?: string;
  routePath: string;
  pageUrl?: string;
  viewport: { width: number; height: number };
}

export interface ChatSummary {
  category: string;
  severity: string;
  title: string;
  description: string;
  actionItems: string[];
  userSentiment: string;
}

export interface TriageProposal {
  version: number;
  createdAt: string;
  classification: 'real_bug' | 'confused_user' | 'duplicate' | 'out_of_scope' | 'needs_info';
  confidence: number;
  themeId: string;
  themeDescription: string;
  suspectedRepo: string | null;
  suspectedFiles: Array<{ path: string; line: number; excerpt: string }>;
  rationale: string;
  revisions: Array<{ version: number; prompt: string; instruction: string | null; createdAt: string }>;
}

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
  chatMessages?: ChatMessage[] | string;
  annotations?: ScreenshotAnnotation[] | string;
  chatSummary?: ChatSummary | string;
  status: string;
  processingError?: string;
  reviewStatus?: ReviewStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  triageProposal?: TriageProposal | null;
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
  const res = await fetch(`${API_URL}/sessions${params}`, {
    cache: 'no-store',
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  const data = await res.json();
  return (data.sessions || []).map(normalizeSession);
}

export async function getSession(sessionId: string, appId: string): Promise<FeedbackSession> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}?appId=${encodeURIComponent(appId)}`, {
    cache: 'no-store',
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return normalizeSession(await res.json());
}

/**
 * Derive a safe pathname from an annotation's pageUrl for display as a route.
 *
 * Parsing against a dummy base (`https://redacted.invalid`) handles both
 * absolute and relative URLs, and `URL#pathname` strips any query string or
 * hash fragment — which may carry PHI-bearing identifiers like
 * `?name=Jane+Doe` or `#/mrn=123`. If the URL is truly unparseable, fall back
 * to `/`.
 */
export function derivePathname(pageUrl: string | undefined): string {
  if (!pageUrl) return '/';
  try {
    return new URL(pageUrl, 'https://redacted.invalid').pathname || '/';
  } catch {
    return '/';
  }
}

function normalizeSession(session: FeedbackSession): FeedbackSession {
  if ((session.reviewStatus as string | undefined) === 'in_review') {
    session.reviewStatus = 'in_progress';
  }
  if (typeof session.events === 'string') {
    session.events = JSON.parse(session.events);
  }
  if (typeof session.actionItems === 'string') {
    session.actionItems = JSON.parse(session.actionItems);
  }
  if (typeof session.chatMessages === 'string') {
    session.chatMessages = JSON.parse(session.chatMessages);
  }
  if (typeof session.annotations === 'string') {
    session.annotations = JSON.parse(session.annotations);
  }
  if (Array.isArray(session.annotations)) {
    session.annotations = session.annotations.map((annotation) => ({
      ...annotation,
      routePath: annotation.routePath || derivePathname(annotation.pageUrl),
    }));
  }
  if (typeof session.chatSummary === 'string') {
    session.chatSummary = JSON.parse(session.chatSummary);
  }
  if (typeof session.triageProposal === 'string') {
    try {
      session.triageProposal = JSON.parse(session.triageProposal);
    } catch {
      session.triageProposal = null;
    }
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
    'evidence-engine-extension': '/Users/stevearbogast/dev/repos/sevaro-evidence-engine/chrome-extension/',
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
  prompt += `Update the action item statuses in the feedback system by running these commands. The feedback API requires an \`x-api-key\` header; the first line fetches it from AWS Secrets Manager (requires \`sevaro-sandbox\` AWS credentials), and the \`&&\` ensures the curl is only attempted if the key fetch succeeds:\n\n`;
  prompt += '```bash\n';

  // Build the updated action items with status changed to "resolved"
  const resolvedItems = actionItems.map((item) => ({
    ...item,
    status: 'resolved',
  }));

  const sessionId = sessions[0]?.sessionId;
  const appId = sessions[0]?.appId;

  if (sessionId && appId) {
    prompt += `FEEDBACK_API_KEY=$(AWS_PROFILE=sevaro-sandbox aws secretsmanager get-secret-value --region us-east-2 --secret-id sevaro/feedback-api-key --query 'SecretString' --output text) && \\\n`;
    prompt += `curl -s -X PUT "https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback/sessions/${sessionId}" \\\n`;
    prompt += `  -H "Content-Type: application/json" \\\n`;
    prompt += `  -H "x-api-key: $FEEDBACK_API_KEY" \\\n`;
    prompt += `  -d '${JSON.stringify({ appId, status: 'addressed', actionItems: resolvedItems })}'\n`;
  }

  prompt += '```\n\n';
  prompt += `This marks the session as "addressed" and all action items as "resolved" in the feedback dashboard so the team knows it has been handled.\n`;

  return prompt;
}

/**
 * Client-safe DTO for the session detail page.
 *
 * Only whitelisted fields are serialized into the RSC/client payload. Legacy
 * annotation fields that older Lambda versions stored verbatim (raw pageUrl,
 * screenshot S3 URLs/keys, arbitrary elementInfo metadata) are stripped at the
 * server/client boundary so they cannot leak into the browser even if no UI
 * element renders them today.
 *
 * Any new field rendered by `SessionDetailClient` must be added here
 * explicitly — the DTO is the contract.
 */
export interface SessionDetailClientDTO {
  sessionId: string;
  appId: string;
  userLabel?: string;
  category: string;
  duration: number;
  screenSize?: string;
  status: string;
  processingError?: string;
  reviewStatus?: ReviewStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  aiSummary?: string;
  transcript?: string;
  createdAt: string;
}

export interface AnnotationClientDTO {
  coordinates: { x: number; y: number };
  viewport: { width: number; height: number };
  elementInfo: {
    tag: string;
    selector?: string;
    role?: string;
    testId?: string;
    dataTour?: string;
    className?: string;
  };
  routePath: string;
  userComment?: string;
}

/**
 * Build the redacted session DTO rendered by the client component. Drops
 * heavy/unused fields (events, actionItems, chatMessages — passed as separate
 * props) and any top-level keys not explicitly whitelisted above.
 */
export function toSessionDetailDTO(session: FeedbackSession): SessionDetailClientDTO {
  return {
    sessionId: session.sessionId,
    appId: session.appId,
    userLabel: session.userLabel,
    category: session.category,
    duration: session.duration,
    screenSize: session.screenSize,
    status: session.status,
    processingError: session.processingError,
    reviewStatus: session.reviewStatus,
    resolutionNote: session.resolutionNote,
    resolvedBy: session.resolvedBy,
    resolvedAt: session.resolvedAt,
    aiSummary: session.aiSummary,
    transcript: session.transcript,
    createdAt: session.createdAt,
  };
}

/**
 * Redact a single annotation for client rendering. Strips `pageUrl`,
 * `screenshotKey`, `screenshotUrl`, and any elementInfo keys outside the
 * explicit whitelist — older clients wrote arbitrary DOM metadata here that
 * could carry PHI (e.g. aria-label text, raw innerText).
 */
export function toAnnotationDTO(annotation: ScreenshotAnnotation): AnnotationClientDTO {
  const info = annotation.elementInfo || { selector: '', tag: '' };
  return {
    coordinates: {
      x: annotation.coordinates?.x ?? 0,
      y: annotation.coordinates?.y ?? 0,
    },
    viewport: {
      width: annotation.viewport?.width ?? 0,
      height: annotation.viewport?.height ?? 0,
    },
    elementInfo: {
      tag: info.tag,
      selector: info.selector,
      role: info.role,
      testId: info.testId,
      dataTour: info.dataTour,
      className: info.className,
    },
    routePath: annotation.routePath,
    userComment: annotation.userComment,
  };
}

/**
 * Client-safe DTO for chat-attachment payloads.
 *
 * Reuses {@link AnnotationClientDTO} for the nested annotation so the same
 * whitelist applies (no pageUrl / screenshotUrl / screenshotKey; elementInfo
 * narrowed to the rendered keys). The top-level `annotations` array on the
 * session was already redacted on the server; this DTO closes the parallel
 * leak through `chatMessages[].attachments[].annotation`.
 */
export interface ChatAttachmentClientDTO {
  type: 'annotation' | 'voice-transcript';
  annotation?: AnnotationClientDTO;
}

/**
 * Client-safe DTO for a chat message. Only fields the UI actually renders are
 * serialized: `id`, `role`, `content`, `timestamp`, and a redacted
 * `attachments` array. The raw `key` / `url` fields on a ChatAttachment are
 * dropped — the UI only checks `type` on attachments, and rendering raw S3
 * URLs in the RSC/browser payload is exactly the leak this DTO prevents.
 */
export interface ChatMessageClientDTO {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: ChatAttachmentClientDTO[];
}

/**
 * Redact a chat message for client rendering. Runs every attachment's nested
 * `annotation` through {@link toAnnotationDTO} so the same whitelist applies.
 *
 * Codex round-2 H#1: the top-level `annotations` array was already redacted
 * via {@link toSessionDetailDTO} + {@link toAnnotationDTO}, but chat messages
 * shipped raw to the client — each `ChatAttachment.annotation` still carried
 * `pageUrl` (often `/patient/<id>?name=...`), `screenshotUrl`, `screenshotKey`
 * and arbitrary legacy `elementInfo` keys. This helper closes that channel.
 */
export function toChatMessageDTO(msg: ChatMessage): ChatMessageClientDTO {
  const attachments = msg.attachments?.map((a) => {
    const redacted: ChatAttachmentClientDTO = { type: a.type };
    if (a.annotation) {
      redacted.annotation = toAnnotationDTO(a.annotation);
    }
    return redacted;
  });
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    ...(attachments ? { attachments } : {}),
  };
}
