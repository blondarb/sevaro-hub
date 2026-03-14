import { listSessions, formatDuration } from '@/lib/feedback-api';
import type { FeedbackSession } from '@/lib/feedback-api';
import Link from 'next/link';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  bug: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  suggestion: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  confusion: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  praise: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
  cosmetic: '#6b7280',
};

const STATUS_LABELS: Record<string, { bg: string; text: string; label: string }> = {
  recording: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Recording' },
  submitted: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Processing' },
  transcribed: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'Transcribed' },
  summarized: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Ready' },
  error: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Error' },
};

export const dynamic = 'force-dynamic';

export default async function FeedbackListPage() {
  let sessions: FeedbackSession[] = [];
  let error: string | null = null;

  try {
    sessions = await listSessions();
    sessions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load sessions';
  }

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; min-height: 100vh; }
        .fb-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
        .fb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
        .fb-header h1 { font-size: 1.8rem; font-weight: 700; background: linear-gradient(135deg, #c8d8f0, #7aa2d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .fb-back { color: #7aa2d4; text-decoration: none; font-size: 0.9rem; }
        .fb-back:hover { text-decoration: underline; }
        .fb-stats { display: flex; gap: 16px; margin-bottom: 24px; }
        .fb-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; flex: 1; }
        .fb-stat-value { font-size: 1.6rem; font-weight: 700; color: #d0d8e8; }
        .fb-stat-label { font-size: 0.78rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.08em; }
        .fb-session { display: block; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; margin-bottom: 10px; text-decoration: none; color: inherit; transition: all 0.15s; }
        .fb-session:hover { background: rgba(255,255,255,0.06); border-color: rgba(120,160,220,0.25); transform: translateY(-1px); }
        .fb-session-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .fb-badge { display: inline-block; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px; }
        .fb-session-summary { font-size: 0.88rem; color: #8890a4; line-height: 1.5; }
        .fb-session-meta { display: flex; gap: 16px; margin-top: 8px; font-size: 0.78rem; color: #5a6580; }
        .fb-action-count { display: flex; gap: 4px; align-items: center; }
        .fb-severity-dot { width: 8px; height: 8px; border-radius: 4px; display: inline-block; }
        .fb-empty { text-align: center; padding: 60px 20px; color: #5a6580; }
        .fb-empty p { font-size: 1.1rem; margin-bottom: 8px; }
        .fb-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 16px; color: #f87171; margin-bottom: 20px; }
        @media (max-width: 600px) { .fb-stats { flex-direction: column; } .fb-session-top { gap: 6px; } }
      `}</style>

      <div className="fb-container">
        <div className="fb-header">
          <h1>Feedback Dashboard</h1>
          <Link href="/" className="fb-back">&larr; Hub</Link>
        </div>

        {error && <div className="fb-error">{error}</div>}

        {/* Stats */}
        <div className="fb-stats">
          <div className="fb-stat">
            <div className="fb-stat-value">{sessions.length}</div>
            <div className="fb-stat-label">Sessions</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-value">
              {sessions.reduce((acc, s) => {
                const items = Array.isArray(s.actionItems) ? s.actionItems : [];
                return acc + items.length;
              }, 0)}
            </div>
            <div className="fb-stat-label">Action Items</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-value">
              {new Set(sessions.map((s) => s.appId)).size}
            </div>
            <div className="fb-stat-label">Apps</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-value">
              {sessions.reduce((acc, s) => {
                const items = Array.isArray(s.actionItems) ? s.actionItems : [];
                return acc + items.filter((i) => i.severity === 'critical').length;
              }, 0)}
            </div>
            <div className="fb-stat-label">Critical</div>
          </div>
        </div>

        {/* Session list */}
        {sessions.length === 0 && !error && (
          <div className="fb-empty">
            <p>No feedback sessions yet</p>
            <span>Sessions will appear here when users submit feedback via the widget</span>
          </div>
        )}

        {sessions.map((session) => {
          const cat = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.suggestion;
          const statusInfo = STATUS_LABELS[session.status] || STATUS_LABELS.submitted;
          const actionItems = Array.isArray(session.actionItems) ? session.actionItems : [];
          const date = session.createdAt ? new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

          return (
            <Link
              key={session.sessionId}
              href={`/feedback/${session.sessionId}?appId=${session.appId}`}
              className="fb-session"
            >
              <div className="fb-session-top">
                <span className="fb-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>
                  {session.appId}
                </span>
                <span className="fb-badge" style={{ background: cat.bg, color: cat.text }}>
                  {session.category}
                </span>
                <span className="fb-badge" style={{ background: statusInfo.bg, color: statusInfo.text }}>
                  {statusInfo.label}
                </span>
                {actionItems.length > 0 && (
                  <div className="fb-action-count">
                    {(['critical', 'major', 'minor', 'cosmetic'] as const).map((sev) => {
                      const count = actionItems.filter((i) => i.severity === sev).length;
                      if (count === 0) return null;
                      return (
                        <span key={sev} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: SEVERITY_COLORS[sev] }}>
                          <span className="fb-severity-dot" style={{ background: SEVERITY_COLORS[sev] }} />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="fb-session-summary">
                {session.aiSummary || session.transcript?.slice(0, 150) || 'Processing...'}
              </div>
              <div className="fb-session-meta">
                <span>{session.userLabel || 'Anonymous'}</span>
                <span>{formatDuration(session.duration || 0)}</span>
                <span>{date}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
