'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getIdToken } from '@/lib/auth';
import type { ImprovementEntry } from '@/lib/improvement-queue-api';
import {
  getAllImprovements,
  updateImprovement,
  deleteImprovement,
} from '@/lib/improvement-queue-api';

const REPO_OPTIONS = [
  { value: 'sevaro-evidence-engine', label: 'Evidence Engine' },
  { value: 'sevaro-hub', label: 'Sevaro Hub' },
  { value: 'SevaroNeuro-scribe-chrome', label: 'NeuroScribe Extension' },
  { value: 'sevaro-scribe', label: 'Sevaro Scribe' },
  { value: 'Workouts', label: 'Workouts' },
  { value: 'RepGenius', label: 'RepGenius' },
  { value: 'SevaroMonitor', label: 'Sevaro Monitor' },
  { value: 'github-showcase', label: 'GitHub Showcase' },
  { value: 'OPSAmplehtml', label: 'OPSAmple' },
];

const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 — Critical', color: '#f87171' },
  { value: 'P2', label: 'P2 — Important', color: '#fbbf24' },
  { value: 'P3', label: 'P3 — Nice to Have', color: '#60a5fa' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#8890a4' },
  { value: 'in-progress', label: 'In Progress', color: '#fbbf24' },
  { value: 'completed', label: 'Completed', color: '#4ade80' },
  { value: 'deferred', label: 'Deferred', color: '#a78bfa' },
];

const SCOPE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  P1: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  P2: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  P3: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(136,144,164,0.15)', text: '#8890a4' },
  'in-progress': { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  completed: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
  deferred: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
};

const SCOPE_STYLES: Record<string, { bg: string; text: string }> = {
  small: { bg: 'rgba(34,197,94,0.1)', text: '#4ade80' },
  medium: { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24' },
  large: { bg: 'rgba(239,68,68,0.1)', text: '#f87171' },
};

export default function ImprovementsAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ImprovementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRepo, setFilterRepo] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const data = await getAllImprovements(token);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  async function handleStatusChange(item: ImprovementEntry, newStatus: string) {
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      await updateImprovement(item.repoName, item.promptId, { status: newStatus as ImprovementEntry['status'] }, token);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleDelete(repoName: string, promptId: string) {
    if (!confirm(`Delete improvement ${promptId} from ${repoName}?`)) return;
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      await deleteImprovement(repoName, promptId, token);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function copyPrompt(item: ImprovementEntry) {
    const prompt = item.promptText || `Run the improvement prompt at ${item.promptFile} in the ${item.repoName} repo.`;
    navigator.clipboard.writeText(prompt);
    setCopiedId(`${item.repoName}-${item.promptId}`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#5a6580' }}>
        <p>Admin access required.</p>
        <Link href="/login" style={{ color: '#7aa2d4' }}>Sign in</Link>
      </div>
    );
  }

  // Apply filters
  let filtered = items;
  if (filterRepo) filtered = filtered.filter((i) => i.repoName === filterRepo);
  if (filterPriority) filtered = filtered.filter((i) => i.priority === filterPriority);
  if (filterStatus) filtered = filtered.filter((i) => i.status === filterStatus);

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const inProgressCount = items.filter((i) => i.status === 'in-progress').length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const repoCount = new Set(items.map((i) => i.repoName)).size;

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; }
        .iq-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
        .iq-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .iq-header h1 { font-size: 1.6rem; font-weight: 700; background: linear-gradient(135deg, #c8d8f0, #7aa2d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .iq-back { color: #7aa2d4; text-decoration: none; font-size: 0.9rem; }
        .iq-back:hover { text-decoration: underline; }
        .iq-toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .iq-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; color: #d0d8e8; font-size: 0.82rem; font-family: inherit; }
        .iq-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(122,162,212,0.3); background: rgba(122,162,212,0.1); color: #7aa2d4; font-size: 0.82rem; cursor: pointer; font-family: inherit; font-weight: 500; }
        .iq-btn:hover { background: rgba(122,162,212,0.2); }
        .iq-btn-copy { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); color: #4ade80; }
        .iq-btn-copy:hover { background: rgba(34,197,94,0.15); }
        .iq-btn-danger { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #f87171; }
        .iq-btn-danger:hover { background: rgba(239,68,68,0.15); }
        .iq-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
        .iq-card:hover { border-color: rgba(255,255,255,0.12); }
        .iq-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .iq-badge { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 3px; }
        .iq-card-title { font-size: 0.88rem; font-weight: 500; color: #d0d8e8; }
        .iq-card-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 0.72rem; color: #5a6580; align-items: center; flex-wrap: wrap; }
        .iq-expand { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 14px 18px; margin-top: 8px; margin-bottom: 8px; }
        .iq-prompt-text { font-size: 0.8rem; color: #8890a4; line-height: 1.5; white-space: pre-wrap; font-family: 'SF Mono', 'Fira Code', monospace; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; max-height: 300px; overflow-y: auto; }
        .iq-empty { text-align: center; padding: 40px; color: #5a6580; font-size: 0.9rem; }
        .iq-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 10px 14px; color: #f87171; margin-bottom: 16px; font-size: 0.85rem; }
        .iq-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .iq-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; min-width: 80px; }
        .iq-stat-value { font-size: 1.4rem; font-weight: 700; color: #d0d8e8; }
        .iq-stat-label { font-size: 0.7rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.06em; }
        .iq-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; }
      `}</style>

      <div className="iq-container">
        <div className="iq-header">
          <h1>Improvement Queue</h1>
          <Link href="/" className="iq-back">&larr; Hub</Link>
        </div>

        {error && (
          <div className="iq-error">
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}

        {/* Stats */}
        <div className="iq-stats">
          <div className="iq-stat">
            <div className="iq-stat-value">{items.length}</div>
            <div className="iq-stat-label">Total</div>
          </div>
          <div className="iq-stat">
            <div className="iq-stat-value" style={{ color: '#8890a4' }}>{pendingCount}</div>
            <div className="iq-stat-label">Pending</div>
          </div>
          <div className="iq-stat">
            <div className="iq-stat-value" style={{ color: '#fbbf24' }}>{inProgressCount}</div>
            <div className="iq-stat-label">In Progress</div>
          </div>
          <div className="iq-stat">
            <div className="iq-stat-value" style={{ color: '#4ade80' }}>{completedCount}</div>
            <div className="iq-stat-label">Completed</div>
          </div>
          <div className="iq-stat">
            <div className="iq-stat-value">{repoCount}</div>
            <div className="iq-stat-label">Repos</div>
          </div>
        </div>

        {/* Filters */}
        <div className="iq-toolbar">
          <select className="iq-select" value={filterRepo} onChange={(e) => setFilterRepo(e.target.value)}>
            <option value="">All repos</option>
            {REPO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select className="iq-select" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select className="iq-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: '#5a6580', marginLeft: 8 }}>
            {filtered.length} of {items.length} shown
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="iq-empty">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="iq-empty">
            {items.length === 0 ? 'No improvements yet.' : 'No improvements match filters.'}
          </div>
        ) : (
          filtered.map((item) => {
            const pStyle = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.P3;
            const sStyle = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
            const scStyle = item.estimatedScope ? SCOPE_STYLES[item.estimatedScope] : null;
            const repoLabel = REPO_OPTIONS.find((o) => o.value === item.repoName)?.label || item.repoName;
            const itemKey = `${item.repoName}-${item.promptId}`;
            const isExpanded = expandedId === itemKey;
            const isCopied = copiedId === itemKey;
            const date = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '';

            return (
              <div key={itemKey}>
                <div
                  className="iq-card"
                  onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                >
                  <div className="iq-card-top">
                    <span className="iq-badge" style={{ background: pStyle.bg, color: pStyle.text }}>
                      {item.priority}
                    </span>
                    <span className="iq-badge" style={{ background: sStyle.bg, color: sStyle.text }}>
                      {item.status}
                    </span>
                    <span className="iq-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>
                      {repoLabel}
                    </span>
                    {scStyle && (
                      <span className="iq-badge" style={{ background: scStyle.bg, color: scStyle.text }}>
                        {item.estimatedScope}
                      </span>
                    )}
                    <span className="iq-card-title" style={{ marginLeft: 4 }}>
                      {item.title}
                    </span>
                  </div>
                  <div className="iq-card-meta">
                    <span>{item.promptId}</span>
                    {date && <span>{date}</span>}
                    {item.planFile && <span>Plan: {item.planFile}</span>}
                    <div className="iq-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`iq-btn ${isCopied ? '' : 'iq-btn-copy'}`}
                        style={{ padding: '2px 10px', fontSize: '0.7rem', ...(isCopied ? { background: 'rgba(34,197,94,0.3)', color: '#fff' } : {}) }}
                        onClick={() => copyPrompt(item)}
                      >
                        {isCopied ? 'Copied!' : 'Copy Prompt'}
                      </button>
                      <select
                        className="iq-select"
                        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                        value={item.status}
                        onChange={(e) => handleStatusChange(item, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        className="iq-btn iq-btn-danger"
                        style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                        onClick={() => handleDelete(item.repoName, item.promptId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="iq-expand">
                    {item.promptText ? (
                      <div className="iq-prompt-text">{item.promptText}</div>
                    ) : item.promptFile ? (
                      <div style={{ fontSize: '0.82rem', color: '#8890a4' }}>
                        Prompt file: <code style={{ color: '#7aa2d4' }}>{item.promptFile}</code>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: '#5a6580' }}>
                          Open the repo and read this file for the full prompt.
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#5a6580' }}>No prompt text available.</div>
                    )}
                    {item.completedAt && (
                      <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#4ade80' }}>
                        Completed: {new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    {item.whatsNewEntry && (
                      <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#60a5fa' }}>
                        What&apos;s New entry: {item.whatsNewEntry}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
