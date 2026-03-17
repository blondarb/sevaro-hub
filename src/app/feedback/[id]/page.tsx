import { getSession, formatDuration, formatTimestamp, generateClaudeCodePrompt } from '@/lib/feedback-api';
import type { FeedbackEvent, ActionItem, ChatMessage, ScreenshotAnnotation, ChatSummary } from '@/lib/feedback-api';
import Link from 'next/link';
import { SessionDetailClient } from './SessionDetailClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appId?: string }>;
}

export default async function SessionDetailPage({ params, searchParams }: Props) {
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
  const annotations = (Array.isArray(session.annotations) ? session.annotations : []) as ScreenshotAnnotation[];
  const chatSummary = (typeof session.chatSummary === 'object' && session.chatSummary !== null ? session.chatSummary : null) as ChatSummary | null;
  const audioUrl = session.audioUrl || '';

  // Generate Claude Code prompt if there are action items
  const claudePrompt = actionItems.length > 0
    ? generateClaudeCodePrompt(session.appId, actionItems, [session])
    : null;

  return (
    <SessionDetailClient
      session={session}
      events={events}
      actionItems={actionItems}
      chatMessages={chatMessages}
      annotations={annotations}
      chatSummary={chatSummary}
      audioUrl={audioUrl}
      claudePrompt={claudePrompt}
    />
  );
}
