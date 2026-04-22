import { getSession, generateClaudeCodePrompt, toSessionDetailDTO, toAnnotationDTO, toChatMessageDTO } from '@/lib/feedback-api';
import type { FeedbackEvent, ActionItem, ChatMessage, ScreenshotAnnotation, ChatSummary } from '@/lib/feedback-api';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyToken } from '@/lib/verify-auth';
import { SessionDetailClient } from './SessionDetailClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appId?: string }>;
}

export default async function SessionDetailPage({ params, searchParams }: Props) {
  // Server-side auth gate. Without this, a stale tab whose id_token has
  // expired could still render this page (the underlying Lambda GET only
  // requires x-api-key) and only fail when the user clicked Save Status,
  // which produced the silent 401 in the original bug report.
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;
  const user = idToken ? await verifyToken(idToken) : null;

  if (!user) {
    redirect('/api/auth/login');
  }

  if (!user.isAdmin) {
    return (
      <div style={{ padding: 40, color: '#f87171', fontFamily: 'system-ui' }}>
        Admin access required to view feedback sessions.
        <div style={{ marginTop: 12 }}>
          <Link href="/" style={{ color: '#7aa2d4' }}>Back to Hub</Link>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const { appId } = await searchParams;

  if (!appId) {
    return (
      <div style={{ padding: 40, color: '#f87171', fontFamily: 'system-ui' }}>
        Missing appId parameter. <Link href="/feedback" style={{ color: '#7aa2d4' }}>Back to list</Link>
      </div>
    );
  }

  let session;
  try {
    session = await getSession(id, appId);
  } catch {
    return (
      <div style={{ padding: 40, color: '#f87171', fontFamily: 'system-ui' }}>
        Session not found. <Link href="/feedback" style={{ color: '#7aa2d4' }}>Back to list</Link>
      </div>
    );
  }

  const events = (Array.isArray(session.events) ? session.events : []) as FeedbackEvent[];
  const actionItems = (Array.isArray(session.actionItems) ? session.actionItems : []) as ActionItem[];
  const chatMessages = (Array.isArray(session.chatMessages) ? session.chatMessages : []) as ChatMessage[];
  const rawAnnotations = (Array.isArray(session.annotations) ? session.annotations : []) as ScreenshotAnnotation[];
  const chatSummary = (typeof session.chatSummary === 'object' && session.chatSummary !== null ? session.chatSummary : null) as ChatSummary | null;
  const audioUrl = session.audioUrl || '';

  // Generate Claude Code prompt if there are action items
  const claudePrompt = actionItems.length > 0
    ? generateClaudeCodePrompt(session.appId, actionItems, [session])
    : null;

  // Build redacted client DTOs at the server/client boundary. Passing the raw
  // `session` object would serialize legacy annotation fields (`pageUrl`,
  // `screenshotUrl`) and any extra `elementInfo` keys into the RSC payload
  // even if no UI element renders them, leaking to the browser. The DTO
  // builders whitelist only the fields `SessionDetailClient` actually reads.
  //
  // Codex R2 H#1: chat messages have nested annotation attachments whose PHI
  // (pageUrl carrying patient identifiers, raw S3 screenshot keys/URLs, legacy
  // elementInfo with innerText / mrn / etc.) was leaking verbatim until today.
  // `toChatMessageDTO` closes that channel using the same whitelist as the
  // top-level annotations array.
  const sessionDTO = toSessionDetailDTO(session);
  const annotations = rawAnnotations.map(toAnnotationDTO);
  const redactedChatMessages = chatMessages.map(toChatMessageDTO);

  return (
    <SessionDetailClient
      session={sessionDTO}
      events={events}
      actionItems={actionItems}
      chatMessages={redactedChatMessages}
      annotations={annotations}
      chatSummary={chatSummary}
      audioUrl={audioUrl}
      claudePrompt={claudePrompt}
    />
  );
}
