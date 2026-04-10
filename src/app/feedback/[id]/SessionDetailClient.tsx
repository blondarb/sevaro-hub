'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FeedbackSession, FeedbackEvent, ActionItem, ReviewStatus, ChatMessage, ScreenshotAnnotation, ChatSummary } from '@/lib/feedback-api';
import { formatDuration, formatTimestamp } from '@/lib/feedback-api';
import { getIdToken } from '@/lib/auth';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
  cosmetic: '#6b7280',
};

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  'ux-issue': 'UX Issue',
  'feature-request': 'Feature Request',
  'content-fix': 'Content Fix',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  recording: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Recording' },
  submitted: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Processing' },
  transcribed: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'Transcribed' },
  summarized: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Ready' },
  error: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'Processing Failed' },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  bug: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  suggestion: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  confusion: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  praise: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
};

const REVIEW_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Open' },
  in_progress: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'In Progress' },
  resolved: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Resolved' },
  dismissed: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', label: 'Dismissed' },
};

interface Props {
  session: FeedbackSession;
  events: FeedbackEvent[];
  actionItems: ActionItem[];
  chatMessages: ChatMessage[];
  annotations: ScreenshotAnnotation[];
  chatSummary: ChatSummary | null;
  audioUrl: string;
  claudePrompt: string | null;
}

export function SessionDetailClient({ session, events, actionItems, chatMessages, annotations, chatSummary, audioUrl, claudePrompt }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(session.reviewStatus || 'open');
  const [resolutionNote, setResolutionNote] = useState(session.resolutionNote || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notifyOnResolve, setNotifyOnResolve] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryDone, setRetryDone] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const seekTo = (offsetMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = offsetMs / 1000;
      audioRef.current.play();
    }
  };

  const copyPrompt = () => {
    if (claudePrompt) {
      navigator.clipboard.writeText(claudePrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showNotif = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const token = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const handleStatusUpdate = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/feedback/${session.sessionId}?appId=${session.appId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reviewStatus, resolutionNote }),
      });
      if (!res.ok) throw new Error('Failed to update status');

      if (notifyOnResolve && reviewStatus === 'resolved' && session.userLabel) {
        try {
          await fetch(`/api/feedback/${session.sessionId}/notify`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              to: session.userLabel,
              appName: session.appId,
              resolutionNote,
              summary: session.aiSummary,
            }),
          });
          showNotif('success', 'Status updated and notification sent');
        } catch {
          showNotif('success', 'Status updated (email failed)');
        }
      } else {
        showNotif('success', 'Status updated');
      }
    } catch {
      showNotif('error', 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/feedback/${session.sessionId}?appId=${session.appId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/feedback');
    } catch {
      showNotif('error', 'Failed to delete session');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRetryProcessing = async () => {
    setRetrying(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/feedback/${session.sessionId}?appId=${session.appId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'submitted' }),
      });
      if (!res.ok) throw new Error('Failed to retry');
      setRetryDone(true);
      showNotif('success', 'Processing restarted — reload in a minute to check progress');
    } catch {
      showNotif('error', 'Failed to retry processing');
    } finally {
      setRetrying(false);
    }
  };

  const date = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  const currentReviewStyle = REVIEW_STATUS_STYLES[reviewStatus] || REVIEW_STATUS_STYLES.open;

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; min-height: 100vh; }
        .sd-container { max-width: 1000px; margin: 0 auto; padding: 32px 24px 80px; }
        .sd-back { color: #7aa2d4; text-decoration: none; font-size: 0.9rem; display: inline-block; margin-bottom: 20px; }
        .sd-back:hover { text-decoration: underline; }
        .sd-header { margin-bottom: 24px; }
        .sd-header h1 { font-size: 1.4rem; font-weight: 700; color: #d0d8e8; margin-bottom: 8px; }
        .sd-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .sd-badge { display: inline-block; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px; }
        .sd-meta { font-size: 0.82rem; color: #5a6580; display: flex; gap: 16px; flex-wrap: wrap; }
        .sd-summary { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; }
        .sd-summary-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6580; margin-bottom: 8px; }
        .sd-summary-text { font-size: 0.95rem; color: #c0c8d8; line-height: 1.6; }
        .sd-audio { margin-bottom: 20px; }
        .sd-audio audio { width: 100%; border-radius: 8px; }
        .sd-section { margin-bottom: 24px; }
        .sd-section-title { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6580; margin-bottom: 12px; }
        .sd-transcript { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; font-size: 0.92rem; color: #b0b8c8; line-height: 1.7; white-space: pre-wrap; }
        .sd-timeline { display: flex; flex-direction: column; gap: 6px; }
        .sd-event { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: all 0.15s; }
        .sd-event:hover { background: rgba(255,255,255,0.05); border-color: rgba(120,160,220,0.2); }
        .sd-event-time { font-size: 0.78rem; font-family: monospace; color: #7aa2d4; min-width: 40px; padding-top: 1px; }
        .sd-event-type { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; }
        .sd-event-detail { font-size: 0.82rem; color: #8890a4; flex: 1; }
        .sd-actions { display: flex; flex-direction: column; gap: 10px; }
        .sd-action { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px 18px; }
        .sd-action-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .sd-action-title { font-size: 0.95rem; font-weight: 600; color: #d0d8e8; }
        .sd-action-desc { font-size: 0.85rem; color: #8890a4; line-height: 1.5; margin-bottom: 8px; }
        .sd-action-quotes { font-size: 0.82rem; color: #7aa2d4; font-style: italic; }
        .sd-action-pages { font-size: 0.78rem; color: #5a6580; margin-top: 4px; }
        .sd-prompt-section { margin-top: 32px; }
        .sd-prompt-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; border: 1px solid rgba(120,160,220,0.3); background: rgba(120,160,220,0.1); color: #7aa2d4; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .sd-prompt-btn:hover { background: rgba(120,160,220,0.2); }
        .sd-prompt-box { margin-top: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.82rem; color: #b0b8c8; white-space: pre-wrap; line-height: 1.6; max-height: 400px; overflow-y: auto; }
        .sd-copy-btn { margin-top: 8px; padding: 8px 16px; border-radius: 6px; border: none; background: #0d9488; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .sd-copy-btn:hover { background: #0f766e; }
        .sd-chat-transcript { display: flex; flex-direction: column; gap: 10px; }
        .sd-chat-msg { display: flex; }
        .sd-chat-msg-user { justify-content: flex-end; }
        .sd-chat-msg-assistant { justify-content: flex-start; }
        .sd-chat-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
        .sd-chat-bubble-user { background: rgba(13,148,136,0.2); color: #a7f3d0; border-bottom-right-radius: 3px; }
        .sd-chat-bubble-assistant { background: rgba(255,255,255,0.05); color: #c0c8d8; border-bottom-left-radius: 3px; }
        .sd-chat-time { font-size: 0.68rem; color: #5a6580; margin-top: 3px; }
        .sd-chat-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .sd-chat-summary-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 14px; }
        .sd-chat-summary-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6580; margin-bottom: 4px; }
        .sd-chat-summary-value { font-size: 0.9rem; color: #c0c8d8; }
        .sd-annotation { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
        .sd-annotation-element { font-family: 'SF Mono', monospace; font-size: 0.78rem; color: #7aa2d4; }
        .sd-annotation-meta { font-size: 0.78rem; color: #5a6580; }
        @media (max-width: 600px) { .sd-meta { flex-direction: column; gap: 4px; } .sd-chat-summary-grid { grid-template-columns: 1fr; } }
      `}</style>

      {notification && (
        <div style={{
          position: 'fixed', top: 60, right: 24, zIndex: 200,
          padding: '12px 20px', borderRadius: 8,
          background: notification.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
          color: '#fff', fontSize: '0.85rem', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {notification.message}
        </div>
      )}

      <div className="sd-container">
        <Link href="/feedback" className="sd-back">&larr; All Sessions</Link>

        <div className="sd-header">
          <div className="sd-badges">
            <span className="sd-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>{session.appId}</span>
            <span className="sd-badge" style={{ background: (CATEGORY_COLORS[session.category] || CATEGORY_COLORS.suggestion).bg, color: (CATEGORY_COLORS[session.category] || CATEGORY_COLORS.suggestion).text }}>
              {session.category}
            </span>
            {(() => {
              const st = STATUS_STYLES[session.status] || STATUS_STYLES.submitted;
              return (
                <span className="sd-badge" style={{ background: st.bg, color: st.text }}>
                  {session.status === 'error' ? '\u26A0 ' : ''}{st.label}
                </span>
              );
            })()}
            <span className="sd-badge" style={{ background: currentReviewStyle.bg, color: currentReviewStyle.text }}>
              {currentReviewStyle.label}
            </span>
          </div>
          <h1>Feedback from {session.userLabel || 'Anonymous'}</h1>
          <div className="sd-meta">
            <span>{date}</span>
            <span>{formatDuration(session.duration || 0)}</span>
            <span>{session.screenSize || 'Unknown screen'}</span>
            <span>{events.length} events</span>
            {chatMessages.length > 0 && <span>{chatMessages.length} chat msgs</span>}
            {annotations.length > 0 && <span>{annotations.length} annotations</span>}
          </div>
        </div>

        {/* Processing Error Banner */}
        {session.status === 'error' && (
          <div style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: session.processingError ? 8 : 0 }}>
              <span style={{ fontSize: '1.1rem' }}>{'\u26A0\uFE0F'}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                Processing Failed
              </span>
              {!retryDone && (
                <button onClick={handleRetryProcessing} disabled={retrying} style={{
                  marginLeft: 'auto', padding: '5px 14px', borderRadius: 6,
                  border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.15)',
                  color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600,
                  cursor: retrying ? 'not-allowed' : 'pointer',
                }}>
                  {retrying ? 'Retrying...' : 'Retry Processing'}
                </button>
              )}
              {retryDone && (
                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#4ade80', fontWeight: 600 }}>
                  Resubmitted for processing
                </span>
              )}
            </div>
            {session.processingError && (
              <div style={{
                fontSize: '0.82rem', color: '#b0a070', lineHeight: 1.5,
                background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 12px',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}>
                {session.processingError}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#8890a4', marginTop: 8 }}>
              The feedback chat data was captured successfully. Only the async post-processing (transcription/AI summary) failed.
            </div>
          </div>
        )}

        {/* Admin: Status Management */}
        <div style={{
          background: 'rgba(122,162,212,0.05)',
          border: '1px solid rgba(122,162,212,0.15)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 20,
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aa2d4', marginBottom: 12 }}>
            Review Status
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['open', 'in_progress', 'resolved', 'dismissed'] as ReviewStatus[]).map((s) => {
              const st = REVIEW_STATUS_STYLES[s];
              const active = reviewStatus === s;
              return (
                <button key={s} onClick={() => setReviewStatus(s)} style={{
                  padding: '5px 14px', borderRadius: 16,
                  border: `2px solid ${active ? st.text : 'rgba(255,255,255,0.08)'}`,
                  background: active ? st.bg : 'transparent',
                  color: active ? st.text : '#5a6580',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                }}>
                  {st.label}
                </button>
              );
            })}
          </div>
          <textarea
            placeholder="Resolution note (optional)"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
              color: '#e0e0e8', fontSize: '0.85rem', resize: 'vertical', minHeight: 60,
              marginBottom: 12, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={handleStatusUpdate} disabled={saving} style={{
                padding: '8px 18px', borderRadius: 6, border: 'none',
                background: saving ? '#3a4560' : '#7aa2d4', color: '#fff',
                fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving...' : 'Save Status'}
              </button>
              {reviewStatus === 'resolved' && session.userLabel?.includes('@') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#8890a4', cursor: 'pointer' }}>
                  <input type="checkbox" checked={notifyOnResolve} onChange={(e) => setNotifyOnResolve(e.target.checked)} />
                  Email {session.userLabel}
                </label>
              )}
            </div>
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
              color: '#f87171', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}>
              Delete Session
            </button>
          </div>
          {session.resolvedBy && (
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#5a6580' }}>
              Resolved by {session.resolvedBy}{session.resolvedAt ? ` on ${new Date(session.resolvedAt).toLocaleDateString()}` : ''}
            </div>
          )}
        </div>

        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ color: '#d0d8e8', marginBottom: 8 }}>Delete this feedback session?</h3>
              <p style={{ color: '#8890a4', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 20 }}>
                This will permanently remove the session record, audio recording, screenshots, and transcript. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8890a4', fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {session.aiSummary && (
          <div className="sd-summary">
            <div className="sd-summary-label">AI Summary</div>
            <div className="sd-summary-text">{session.aiSummary}</div>
          </div>
        )}

        {/* Chat Summary (from AI chatbot conversation) */}
        {chatSummary && (
          <div className="sd-summary">
            <div className="sd-summary-label">Chat Summary (AI-Generated)</div>
            <div style={{ marginBottom: 12 }}>
              <div className="sd-badges" style={{ marginBottom: 8 }}>
                <span className="sd-badge" style={{ background: `${SEVERITY_COLORS[chatSummary.severity] || '#6b7280'}20`, color: SEVERITY_COLORS[chatSummary.severity] || '#6b7280' }}>{chatSummary.severity}</span>
                <span className="sd-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>{chatSummary.category}</span>
                <span className="sd-badge" style={{ background: chatSummary.userSentiment === 'frustrated' ? 'rgba(239,68,68,0.15)' : chatSummary.userSentiment === 'positive' ? 'rgba(34,197,94,0.15)' : 'rgba(160,160,180,0.15)', color: chatSummary.userSentiment === 'frustrated' ? '#f87171' : chatSummary.userSentiment === 'positive' ? '#4ade80' : '#9ca3af' }}>{chatSummary.userSentiment}</span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#d0d8e8', marginBottom: 6 }}>{chatSummary.title}</div>
              <div className="sd-summary-text">{chatSummary.description}</div>
            </div>
            {chatSummary.actionItems.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5a6580', marginBottom: 6 }}>Action Items from Chat</div>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#b0b8c8', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  {chatSummary.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Chat Transcript */}
        {chatMessages.length > 0 && (
          <div className="sd-section">
            <div className="sd-section-title">Chat Transcript ({chatMessages.length} messages)</div>
            <div className="sd-chat-transcript">
              {chatMessages
                .filter(msg => msg.content !== '__init__')
                .map((msg, i) => (
                <div key={msg.id || i} className={`sd-chat-msg sd-chat-msg-${msg.role}`}>
                  <div>
                    <div className={`sd-chat-bubble sd-chat-bubble-${msg.role}`}>
                      {msg.content}
                      {msg.attachments?.some(a => a.type === 'annotation') && (
                        <div style={{ marginTop: 6, fontSize: '0.75rem', color: msg.role === 'user' ? '#6ee7b7' : '#7aa2d4', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                          Screenshot annotation attached
                        </div>
                      )}
                    </div>
                    {msg.timestamp && (
                      <div className="sd-chat-time" style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                        {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screenshot Annotations */}
        {annotations.length > 0 && (
          <div className="sd-section">
            <div className="sd-section-title">Screenshot Annotations ({annotations.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {annotations.map((ann, i) => (
                <div key={i} className="sd-annotation">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="sd-badge" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>Annotation {i + 1}</span>
                    <span style={{ fontSize: '0.78rem', color: '#5a6580' }}>
                      ({ann.coordinates.x}, {ann.coordinates.y}) on {ann.viewport.width}x{ann.viewport.height}
                    </span>
                  </div>
                  <div className="sd-annotation-element">
                    &lt;{ann.elementInfo.tag}&gt; {ann.elementInfo.selector}
                  </div>
                  {ann.elementInfo.text && (
                    <div style={{ fontSize: '0.82rem', color: '#8890a4' }}>
                      Text: &ldquo;{ann.elementInfo.text.slice(0, 150)}{ann.elementInfo.text.length > 150 ? '...' : ''}&rdquo;
                    </div>
                  )}
                  <div className="sd-annotation-meta">
                    Page: {ann.pageUrl}
                  </div>
                  {ann.userComment && (
                    <div style={{ fontSize: '0.85rem', color: '#7aa2d4', fontStyle: 'italic' }}>
                      &ldquo;{ann.userComment}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sd-audio">
          <audio ref={audioRef} controls preload="metadata" src={audioUrl} />
        </div>

        {actionItems.length > 0 && (
          <div className="sd-section">
            <div className="sd-section-title">Action Items ({actionItems.length})</div>
            <div className="sd-actions">
              {actionItems.map((item) => (
                <div key={item.id} className="sd-action">
                  <div className="sd-action-header">
                    <span className="sd-badge" style={{ background: `${SEVERITY_COLORS[item.severity]}20`, color: SEVERITY_COLORS[item.severity] }}>{item.severity}</span>
                    <span className="sd-badge" style={{ background: 'rgba(160,120,240,0.15)', color: '#b89afc' }}>{TYPE_LABELS[item.type] || item.type}</span>
                    <span className="sd-action-title">{item.title}</span>
                  </div>
                  <div className="sd-action-desc">{item.description}</div>
                  {item.userQuotes.length > 0 && (
                    <div className="sd-action-quotes">
                      {item.userQuotes.map((q, i) => <div key={i}>&ldquo;{q}&rdquo;</div>)}
                    </div>
                  )}
                  {item.affectedPages.length > 0 && (
                    <div className="sd-action-pages">Pages: {item.affectedPages.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="sd-section">
            <div className="sd-section-title">Event Timeline</div>
            <div className="sd-timeline">
              {events.map((event, i) => {
                const typeColors: Record<string, { bg: string; text: string }> = {
                  route: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
                  click: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
                  scroll: { bg: 'rgba(160,160,180,0.15)', text: '#9ca3af' },
                  custom: { bg: 'rgba(160,120,240,0.15)', text: '#b89afc' },
                  screenshot: { bg: 'rgba(236,72,153,0.15)', text: '#f472b6' },
                };
                const tc = typeColors[event.type] || typeColors.custom;
                const detail =
                  event.type === 'route' ? `Navigated to ${(event.data as Record<string, string>).path}` :
                  event.type === 'click' ? `Clicked: ${(event.data as Record<string, string>).text || (event.data as Record<string, string>).selector}` :
                  event.type === 'scroll' ? `Scrolled to ${(event.data as Record<string, number>).percent}%${(event.data as Record<string, string>).section ? ` (${(event.data as Record<string, string>).section})` : ''}` :
                  JSON.stringify(event.data);
                return (
                  <div key={i} className="sd-event" onClick={() => seekTo(event.offsetMs)}>
                    <span className="sd-event-time">{formatTimestamp(event.offsetMs)}</span>
                    <span className="sd-event-type" style={{ background: tc.bg, color: tc.text }}>{event.type}</span>
                    <span className="sd-event-detail">{detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {session.transcript && (
          <div className="sd-section">
            <div className="sd-section-title">Full Transcript</div>
            <div className="sd-transcript">{session.transcript}</div>
          </div>
        )}

        {claudePrompt && (
          <div className="sd-prompt-section">
            <div className="sd-section-title">Claude Code Prompt</div>
            <button className="sd-prompt-btn" onClick={() => setShowPrompt(!showPrompt)}>
              {showPrompt ? 'Hide' : 'Show'} Generated Prompt
            </button>
            {showPrompt && (
              <>
                <div className="sd-prompt-box">{claudePrompt}</div>
                <button className="sd-copy-btn" onClick={copyPrompt}>
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
