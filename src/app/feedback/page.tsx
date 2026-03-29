'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getIdToken } from '@/lib/auth';
import { formatDuration } from '@/lib/feedback-api';
import type { FeedbackSession } from '@/lib/feedback-api';
import { APP_TABS, getAppLabel } from '@/lib/app-registry';

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

const REVIEW_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Open' },
  in_progress: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'In Progress' },
  resolved: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Resolved' },
  dismissed: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', label: 'Dismissed' },
};

function isOpen(session: FeedbackSession): boolean {
  return !session.reviewStatus || session.reviewStatus === 'open';
}

export default function FeedbackDashboard() {
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Not authenticated — please sign in');
        const res = await fetch('/api/feedback/sessions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`);
        const data = await res.json();
        const list: FeedbackSession[] = data.sessions || [];
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setSessions(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const badgeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const s of sessions) {
      if (isOpen(s)) {
        counts.all = (counts.all || 0) + 1;
        counts[s.appId] = (counts[s.appId] || 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (activeTab !== 'all' && s.appId !== activeTab) return false;
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (statusFilter) {
        const rs = s.reviewStatus || 'open';
        if (rs !== statusFilter) return false;
      }
      return true;
    });
  }, [sessions, activeTab, categoryFilter, statusFilter]);

  const totalOpen = badgeCounts.all || 0;
  const totalCritical = sessions.reduce((acc, s) => {
    const items = Array.isArray(s.actionItems) ? s.actionItems : [];
    return acc + items.filter((i) => i.severity === 'critical').length;
  }, 0);
  const totalApps = new Set(sessions.map((s) => s.appId)).size;

  const analyzeHref = activeTab === 'all'
    ? '/feedback/analyze'
    : `/feedback/analyze?app=${activeTab}`;

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; min-height: 100vh; }
        .fb-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
        .fb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .fb-header h1 { font-size: 1.6rem; font-weight: 700; background: linear-gradient(135deg, #c8d8f0, #7aa2d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .fb-header-links { display: flex; gap: 12px; align-items: center; font-size: 0.85rem; }
        .fb-header-links a { color: #7aa2d4; text-decoration: none; }
        .fb-header-links a:hover { text-decoration: underline; }
        .fb-header-links span { color: #5a6580; }
        .fb-stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .fb-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 14px; flex: 1; text-align: center; }
        .fb-stat-value { font-size: 1.3rem; font-weight: 700; color: #d0d8e8; }
        .fb-stat-label { font-size: 0.68rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.06em; }
        .fb-tabs { display: flex; gap: 0; border-bottom: 2px solid rgba(255,255,255,0.08); margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
        .fb-tabs::-webkit-scrollbar { display: none; }
        .fb-tab { padding: 8px 14px; font-size: 0.78rem; color: #5a6580; cursor: pointer; white-space: nowrap; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s; background: none; border-top: none; border-left: none; border-right: none; font-family: inherit; }
        .fb-tab:hover { color: #8890a4; }
        .fb-tab-active { color: #7aa2d4; border-bottom-color: #7aa2d4; font-weight: 600; }
        .fb-tab-badge { background: #ef4444; color: white; font-size: 0.58rem; font-weight: 700; padding: 1px 5px; border-radius: 8px; margin-left: 4px; }
        .fb-chips { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .fb-chip { border-radius: 6px; padding: 4px 10px; font-size: 0.72rem; }
        .fb-filter-chip { transition: background 0.15s, border-color 0.15s; }
        .fb-filter-chip:hover { opacity: 0.85; }
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
          <div className="fb-header-links">
            <Link href={analyzeHref}>Analyze</Link>
            <span>|</span>
            <Link href="/">&larr; Hub</Link>
          </div>
        </div>

        {error && <div className="fb-error">{error}</div>}

        <div className="fb-stats">
          <div className="fb-stat">
            <div className="fb-stat-value">{sessions.length}</div>
            <div className="fb-stat-label">Sessions</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-value" style={{ color: totalOpen > 0 ? '#f87171' : undefined }}>{totalOpen}</div>
            <div className="fb-stat-label">Open</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-value" style={{ color: totalCritical > 0 ? '#ef4444' : undefined }}>{totalCritical}</div>
            <div className="fb-stat-label">Critical</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-value">{totalApps}</div>
            <div className="fb-stat-label">Apps</div>
          </div>
        </div>

        <div className="fb-tabs">
          {APP_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`fb-tab ${activeTab === tab.id ? 'fb-tab-active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setCategoryFilter(null); setStatusFilter(null); }}
            >
              {tab.label}
              {(badgeCounts[tab.id] || 0) > 0 && (
                <span className="fb-tab-badge">{badgeCounts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>

        {!loading && sessions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="fb-chips">
              {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => {
                const count = sessions.filter(
                  (s) => (activeTab === 'all' || s.appId === activeTab) && s.category === cat
                ).length;
                if (count === 0) return null;
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    className="fb-chip fb-filter-chip"
                    onClick={() => setCategoryFilter(active ? null : cat)}
                    style={{
                      background: active ? colors.bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? colors.text + '60' : 'rgba(255,255,255,0.1)'}`,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ color: active ? colors.text : '#8890a4', fontWeight: 600 }}>{count}</span>{' '}
                    <span style={{ color: active ? colors.text : '#6a7080' }}>{cat}{count !== 1 ? 's' : ''}</span>
                  </button>
                );
              })}
            </div>
            <div className="fb-chips" style={{ marginBottom: 0 }}>
              {Object.entries(REVIEW_STATUS_STYLES).map(([key, rs]) => {
                const count = sessions.filter(
                  (s) => (activeTab === 'all' || s.appId === activeTab) && (s.reviewStatus || 'open') === key
                ).length;
                if (count === 0) return null;
                const active = statusFilter === key;
                return (
                  <button
                    key={key}
                    className="fb-chip fb-filter-chip"
                    onClick={() => setStatusFilter(active ? null : key)}
                    style={{
                      background: active ? rs.bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? rs.text + '60' : 'rgba(255,255,255,0.1)'}`,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ color: active ? rs.text : '#8890a4', fontWeight: 600 }}>{count}</span>{' '}
                    <span style={{ color: active ? rs.text : '#6a7080' }}>{rs.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="fb-empty"><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="fb-empty">
            <p>{categoryFilter || statusFilter ? 'No sessions match the selected filters' : activeTab === 'all' ? 'No feedback sessions yet' : `No feedback for ${getAppLabel(activeTab)}`}</p>
            {(categoryFilter || statusFilter) ? (
              <button
                onClick={() => { setCategoryFilter(null); setStatusFilter(null); }}
                style={{ background: 'none', border: 'none', color: '#7aa2d4', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}
              >
                Clear filters
              </button>
            ) : (
              <span>Sessions will appear here when users submit feedback via the widget</span>
            )}
          </div>
        ) : (
          filtered.map((session) => {
            const cat = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.suggestion;
            const statusInfo = STATUS_LABELS[session.status] || STATUS_LABELS.submitted;
            const actionItems = Array.isArray(session.actionItems) ? session.actionItems : [];
            const date = session.createdAt
              ? new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : '';
            const rs = REVIEW_STATUS_STYLES[session.reviewStatus || 'open'] || REVIEW_STATUS_STYLES.open;

            return (
              <Link
                key={session.sessionId}
                href={`/feedback/${session.sessionId}?appId=${session.appId}`}
                className="fb-session"
              >
                <div className="fb-session-top">
                  {activeTab === 'all' && (
                    <span className="fb-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>
                      {getAppLabel(session.appId)}
                    </span>
                  )}
                  <span className="fb-badge" style={{ background: cat.bg, color: cat.text }}>
                    {session.category}
                  </span>
                  <span className="fb-badge" style={{ background: statusInfo.bg, color: statusInfo.text }}>
                    {statusInfo.label}
                  </span>
                  <span className="fb-badge" style={{ background: rs.bg, color: rs.text }}>
                    {rs.label}
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
          })
        )}
      </div>
    </>
  );
}
