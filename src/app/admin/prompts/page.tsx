'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getIdToken } from '@/lib/auth';
import type { PromptEntry, PromptFeedback } from '@/lib/prompt-registry-api';
import {
  getAllPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getPromptFeedback,
  addPromptFeedback,
  updateFeedback,
} from '@/lib/prompt-registry-api';

const APP_OPTIONS = [
  { value: 'OPSAmple', label: 'OPSAmple' },
  { value: 'sevaro-evidence-engine', label: 'Evidence Engine' },
  { value: 'sevaro-hub', label: 'Sevaro Hub' },
  { value: 'SevaroMonitor', label: 'Sevaro Monitor' },
  { value: 'SevaroNeuro-scribe-chrome', label: 'NeuroScribe Extension' },
  { value: 'sevaro-scribe', label: 'Sevaro Scribe' },
];

const CATEGORY_OPTIONS = [
  { value: 'system-prompt', label: 'System Prompt', color: '#a78bfa' },
  { value: 'improvement', label: 'Improvement', color: '#60a5fa' },
  { value: 'fix', label: 'Fix', color: '#f87171' },
  { value: 'feature', label: 'Feature', color: '#4ade80' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#8890a4' },
  { value: 'active', label: 'Active', color: '#4ade80' },
  { value: 'deployed', label: 'Deployed', color: '#7aa2d4' },
  { value: 'archived', label: 'Archived', color: '#5a6580' },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  'system-prompt': { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
  improvement: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  fix: { bg: 'rgba(248,113,113,0.15)', text: '#f87171' },
  feature: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(136,144,164,0.15)', text: '#8890a4' },
  active: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80' },
  deployed: { bg: 'rgba(122,162,212,0.15)', text: '#7aa2d4' },
  archived: { bg: 'rgba(90,101,128,0.15)', text: '#5a6580' },
};

export default function PromptsAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState<Record<string, PromptFeedback[]>>({});
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  // Refinement state
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refinementResult, setRefinementResult] = useState<{
    promptKey: string;
    feedbackId: string;
    refinedPromptText: string;
    changeSummary: string[];
    originalText: string;
  } | null>(null);

  // Register form state
  const [regForm, setRegForm] = useState({
    appName: 'OPSAmple',
    promptId: '',
    title: '',
    category: 'system-prompt',
    status: 'active',
    feature: '',
    promptText: '',
    sourceFile: '',
  });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const data = await getAllPrompts(token);
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

  const promptKey = (p: PromptEntry) => `${p.appName}#${p.promptId}`;

  async function loadFeedback(p: PromptEntry) {
    const key = promptKey(p);
    try {
      const token = await getIdToken();
      if (!token) return;
      const fb = await getPromptFeedback(key, token);
      setFeedbackMap((prev) => ({ ...prev, [key]: fb }));
    } catch {
      // Silently fail — feedback just won't show
    }
  }

  async function handleExpand(p: PromptEntry) {
    const id = `${p.appName}-${p.promptId}`;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await loadFeedback(p);
  }

  async function handleSubmitFeedback(p: PromptEntry) {
    if (!feedbackText.trim()) return;
    const key = promptKey(p);
    try {
      setFeedbackLoading(key);
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      await addPromptFeedback(key, feedbackText, token);
      setFeedbackText('');
      await loadFeedback(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setFeedbackLoading(null);
    }
  }

  async function handleRefine(p: PromptEntry, fb: PromptFeedback) {
    const key = promptKey(p);
    try {
      setRefiningId(fb.feedbackId);
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/prompts/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ promptText: p.promptText, feedbackText: fb.feedbackText }),
      });
      if (!res.ok) throw new Error('Refinement failed');
      const data = await res.json();

      // Store refinement on the feedback entry
      await updateFeedback(key, fb.feedbackId, {
        refinedPromptText: data.refinedPromptText,
        changeSummary: data.changeSummary?.join('\n') || '',
        refinementStatus: 'refined',
      }, token);

      setRefinementResult({
        promptKey: key,
        feedbackId: fb.feedbackId,
        refinedPromptText: data.refinedPromptText,
        changeSummary: data.changeSummary || [],
        originalText: p.promptText,
      });

      await loadFeedback(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
      setRefiningId(null);
    }
  }

  async function handleApproveRefinement(p: PromptEntry) {
    if (!refinementResult) return;
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Update the prompt text and increment version
      await updatePrompt(p.appName, p.promptId, {
        promptText: refinementResult.refinedPromptText,
        currentVersion: (p.currentVersion || 1) + 1,
      }, token);

      // Mark feedback as approved
      await updateFeedback(
        refinementResult.promptKey,
        refinementResult.feedbackId,
        { refinementStatus: 'approved' },
        token,
      );

      setRefinementResult(null);
      await fetchAll();
      await loadFeedback(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply refinement');
    }
  }

  async function handleRegister() {
    if (!regForm.appName || !regForm.promptId || !regForm.title || !regForm.promptText) {
      setError('App, ID, title, and prompt text are required');
      return;
    }
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Auto-summarize
      let aiSummary = '';
      try {
        const sumRes = await fetch('/api/prompts/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            promptText: regForm.promptText,
            feature: regForm.feature,
            appName: regForm.appName,
          }),
        });
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          aiSummary = `${sumData.purpose} ${sumData.scope} ${sumData.guardrails}`;
        }
      } catch {
        // Non-fatal — just skip summary
      }

      await createPrompt({
        ...regForm,
        category: regForm.category as PromptEntry['category'],
        status: regForm.status as PromptEntry['status'],
        aiSummary,
      }, token);

      setShowRegister(false);
      setRegForm({ appName: 'OPSAmple', promptId: '', title: '', category: 'system-prompt', status: 'active', feature: '', promptText: '', sourceFile: '' });
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register prompt');
    }
  }

  async function handleDelete(p: PromptEntry) {
    if (!confirm(`Delete prompt "${p.title}" from ${p.appName}?`)) return;
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      await deletePrompt(p.appName, p.promptId, token);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
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

  let filtered = items;
  if (filterApp) filtered = filtered.filter((i) => i.appName === filterApp);
  if (filterCategory) filtered = filtered.filter((i) => i.category === filterCategory);
  if (filterStatus) filtered = filtered.filter((i) => i.status === filterStatus);

  const systemPromptCount = items.filter((i) => i.category === 'system-prompt').length;
  const activeCount = items.filter((i) => i.status === 'active').length;
  const appCount = new Set(items.map((i) => i.appName)).size;

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; }
        .pr-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
        .pr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .pr-header h1 { font-size: 1.6rem; font-weight: 700; background: linear-gradient(135deg, #c8d8f0, #7aa2d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .pr-back { color: #7aa2d4; text-decoration: none; font-size: 0.9rem; }
        .pr-back:hover { text-decoration: underline; }
        .pr-toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .pr-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; color: #d0d8e8; font-size: 0.82rem; font-family: inherit; }
        .pr-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(122,162,212,0.3); background: rgba(122,162,212,0.1); color: #7aa2d4; font-size: 0.82rem; cursor: pointer; font-family: inherit; font-weight: 500; }
        .pr-btn:hover { background: rgba(122,162,212,0.2); }
        .pr-btn-green { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); color: #4ade80; }
        .pr-btn-green:hover { background: rgba(34,197,94,0.15); }
        .pr-btn-danger { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #f87171; }
        .pr-btn-danger:hover { background: rgba(239,68,68,0.15); }
        .pr-btn-purple { border-color: rgba(167,139,250,0.3); background: rgba(167,139,250,0.08); color: #a78bfa; }
        .pr-btn-purple:hover { background: rgba(167,139,250,0.15); }
        .pr-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
        .pr-card:hover { border-color: rgba(255,255,255,0.12); }
        .pr-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .pr-badge { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 3px; }
        .pr-card-title { font-size: 0.88rem; font-weight: 500; color: #d0d8e8; }
        .pr-card-summary { font-size: 0.78rem; color: #8890a4; margin-top: 4px; line-height: 1.4; }
        .pr-card-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 0.72rem; color: #5a6580; align-items: center; flex-wrap: wrap; }
        .pr-expand { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 14px 18px; margin-top: 8px; }
        .pr-prompt-text { font-size: 0.8rem; color: #8890a4; line-height: 1.5; white-space: pre-wrap; font-family: 'SF Mono', 'Fira Code', monospace; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; max-height: 300px; overflow-y: auto; }
        .pr-feedback-list { margin-top: 12px; }
        .pr-feedback-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 12px; margin-bottom: 6px; }
        .pr-feedback-text { font-size: 0.8rem; color: #d0d8e8; line-height: 1.4; }
        .pr-feedback-meta { font-size: 0.68rem; color: #5a6580; margin-top: 4px; }
        .pr-feedback-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; color: #d0d8e8; font-size: 0.82rem; font-family: inherit; resize: vertical; min-height: 60px; margin-top: 10px; }
        .pr-diff { margin-top: 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; }
        .pr-diff-header { padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.82rem; font-weight: 600; color: #d0d8e8; }
        .pr-diff-line { padding: 2px 14px; font-size: 0.78rem; font-family: 'SF Mono', monospace; line-height: 1.5; white-space: pre-wrap; }
        .pr-diff-add { background: rgba(34,197,94,0.08); color: #4ade80; }
        .pr-diff-remove { background: rgba(239,68,68,0.08); color: #f87171; }
        .pr-diff-same { color: #5a6580; }
        .pr-changes { margin-top: 10px; padding: 10px 14px; background: rgba(167,139,250,0.05); border: 1px solid rgba(167,139,250,0.1); border-radius: 6px; }
        .pr-changes li { font-size: 0.78rem; color: #a78bfa; margin-bottom: 4px; line-height: 1.4; }
        .pr-empty { text-align: center; padding: 40px; color: #5a6580; font-size: 0.9rem; }
        .pr-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 10px 14px; color: #f87171; margin-bottom: 16px; font-size: 0.85rem; }
        .pr-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .pr-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; min-width: 80px; }
        .pr-stat-value { font-size: 1.4rem; font-weight: 700; color: #d0d8e8; }
        .pr-stat-label { font-size: 0.7rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.06em; }
        .pr-register { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
        .pr-register label { display: block; font-size: 0.75rem; color: #8890a4; margin-bottom: 4px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
        .pr-register input, .pr-register textarea, .pr-register select { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; color: #d0d8e8; font-size: 0.82rem; font-family: inherit; box-sizing: border-box; }
        .pr-register textarea { min-height: 120px; resize: vertical; font-family: 'SF Mono', monospace; }
        .pr-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(167,139,250,0.3); border-top-color: #a78bfa; border-radius: 50%; animation: pr-spin 0.6s linear infinite; }
        @keyframes pr-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="pr-container">
        <div className="pr-header">
          <h1>Prompt Review</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="pr-btn-green pr-btn" onClick={() => setShowRegister(!showRegister)}>
              {showRegister ? 'Cancel' : '+ Register Prompt'}
            </button>
            <Link href="/" className="pr-back">&larr; Hub</Link>
          </div>
        </div>

        {error && (
          <div className="pr-error">
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}

        {/* Register form */}
        {showRegister && (
          <div className="pr-register">
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#d0d8e8', marginBottom: 8 }}>Register New Prompt</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
              <div>
                <label>App</label>
                <select value={regForm.appName} onChange={(e) => setRegForm({ ...regForm, appName: e.target.value })}>
                  {APP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label>Prompt ID (slug)</label>
                <input value={regForm.promptId} onChange={(e) => setRegForm({ ...regForm, promptId: e.target.value })} placeholder="e.g. triage-system" />
              </div>
              <div>
                <label>Title</label>
                <input value={regForm.title} onChange={(e) => setRegForm({ ...regForm, title: e.target.value })} placeholder="e.g. AI Triage Scoring System Prompt" />
              </div>
              <div>
                <label>Feature</label>
                <input value={regForm.feature} onChange={(e) => setRegForm({ ...regForm, feature: e.target.value })} placeholder="e.g. Triage" />
              </div>
              <div>
                <label>Category</label>
                <select value={regForm.category} onChange={(e) => setRegForm({ ...regForm, category: e.target.value })}>
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label>Source File (optional)</label>
                <input value={regForm.sourceFile} onChange={(e) => setRegForm({ ...regForm, sourceFile: e.target.value })} placeholder="e.g. src/lib/triage/systemPrompt.ts" />
              </div>
            </div>
            <label>Prompt Text</label>
            <textarea value={regForm.promptText} onChange={(e) => setRegForm({ ...regForm, promptText: e.target.value })} placeholder="Paste the full prompt text here..." />
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="pr-btn pr-btn-green" onClick={handleRegister}>Register &amp; Auto-Summarize</button>
              <button className="pr-btn" onClick={() => setShowRegister(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="pr-stats">
          <div className="pr-stat">
            <div className="pr-stat-value">{items.length}</div>
            <div className="pr-stat-label">Total</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-value" style={{ color: '#a78bfa' }}>{systemPromptCount}</div>
            <div className="pr-stat-label">System Prompts</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-value" style={{ color: '#4ade80' }}>{activeCount}</div>
            <div className="pr-stat-label">Active</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-value">{appCount}</div>
            <div className="pr-stat-label">Apps</div>
          </div>
        </div>

        {/* Filters */}
        <div className="pr-toolbar">
          <select className="pr-select" value={filterApp} onChange={(e) => setFilterApp(e.target.value)}>
            <option value="">All apps</option>
            {APP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="pr-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="pr-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span style={{ fontSize: '0.75rem', color: '#5a6580', marginLeft: 8 }}>
            {filtered.length} of {items.length} shown
          </span>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="pr-empty">Loading prompts...</div>
        ) : filtered.length === 0 ? (
          <div className="pr-empty">
            {items.length === 0 ? 'No prompts registered yet. Click "+ Register Prompt" to add one.' : 'No prompts match the current filters.'}
          </div>
        ) : (
          filtered.map((item) => {
            const id = `${item.appName}-${item.promptId}`;
            const isExpanded = expandedId === id;
            const key = promptKey(item);
            const feedback = feedbackMap[key] || [];
            const catStyle = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['system-prompt'];
            const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES['draft'];
            const appLabel = APP_OPTIONS.find((o) => o.value === item.appName)?.label || item.appName;

            return (
              <div key={id}>
                <div className="pr-card" onClick={() => handleExpand(item)}>
                  <div className="pr-card-top">
                    <span className="pr-badge" style={{ background: 'rgba(122,162,212,0.15)', color: '#7aa2d4' }}>{appLabel}</span>
                    <span className="pr-badge" style={{ background: catStyle.bg, color: catStyle.text }}>{item.category}</span>
                    <span className="pr-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>{item.status}</span>
                    {item.feature && (
                      <span style={{ fontSize: '0.7rem', color: '#5a6580' }}>{item.feature}</span>
                    )}
                  </div>
                  <div className="pr-card-title">{item.title}</div>
                  {item.aiSummary && (
                    <div className="pr-card-summary">{item.aiSummary}</div>
                  )}
                  <div className="pr-card-meta">
                    {item.sourceFile && <span style={{ fontFamily: 'SF Mono, monospace' }}>{item.sourceFile}</span>}
                    <span>v{item.currentVersion || 1}</span>
                    {item.updatedAt && <span>{new Date(item.updatedAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="pr-expand">
                    {/* Prompt text */}
                    <div style={{ fontSize: '0.75rem', color: '#5a6580', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prompt Text</div>
                    <div className="pr-prompt-text">{item.promptText}</div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="pr-btn pr-btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>Delete</button>
                    </div>

                    {/* Existing feedback */}
                    <div className="pr-feedback-list">
                      <div style={{ fontSize: '0.75rem', color: '#5a6580', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Feedback ({feedback.length})
                      </div>
                      {feedback.map((fb) => (
                        <div key={fb.feedbackId} className="pr-feedback-item">
                          <div className="pr-feedback-text">{fb.feedbackText}</div>
                          <div className="pr-feedback-meta">
                            {fb.createdAt && new Date(fb.createdAt).toLocaleString()}
                            {' · '}
                            <span style={{ color: fb.refinementStatus === 'approved' ? '#4ade80' : fb.refinementStatus === 'refined' ? '#a78bfa' : '#5a6580' }}>
                              {fb.refinementStatus}
                            </span>
                          </div>
                          {fb.refinementStatus === 'pending' && (
                            <button
                              className="pr-btn pr-btn-purple"
                              style={{ marginTop: 6 }}
                              disabled={refiningId === fb.feedbackId}
                              onClick={(e) => { e.stopPropagation(); handleRefine(item, fb); }}
                            >
                              {refiningId === fb.feedbackId ? <><span className="pr-spinner" /> Refining...</> : 'Refine with AI'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* New feedback input */}
                    <textarea
                      className="pr-feedback-input"
                      placeholder="Type your feedback on this prompt..."
                      value={expandedId === id ? feedbackText : ''}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="pr-btn pr-btn-green"
                      style={{ marginTop: 8 }}
                      disabled={!feedbackText.trim() || feedbackLoading === key}
                      onClick={(e) => { e.stopPropagation(); handleSubmitFeedback(item); }}
                    >
                      {feedbackLoading === key ? 'Submitting...' : 'Submit Feedback'}
                    </button>

                    {/* Diff view */}
                    {refinementResult && refinementResult.promptKey === key && (
                      <div className="pr-diff" style={{ marginTop: 14 }}>
                        <div className="pr-diff-header">AI Refinement — Review Changes</div>
                        <div style={{ padding: 10 }}>
                          {renderDiff(refinementResult.originalText, refinementResult.refinedPromptText)}
                        </div>
                        {refinementResult.changeSummary.length > 0 && (
                          <div className="pr-changes">
                            <div style={{ fontSize: '0.72rem', color: '#8890a4', marginBottom: 4, textTransform: 'uppercase' }}>What Changed</div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {refinementResult.changeSummary.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px' }}>
                          <button className="pr-btn pr-btn-green" onClick={(e) => { e.stopPropagation(); handleApproveRefinement(item); }}>
                            Approve &amp; Apply
                          </button>
                          <button className="pr-btn" onClick={(e) => { e.stopPropagation(); setRefinementResult(null); }}>
                            Reject
                          </button>
                        </div>
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

/** Simple line-by-line diff renderer */
function renderDiff(original: string, refined: string) {
  const origLines = original.split('\n');
  const refLines = refined.split('\n');

  // Build a basic diff using longest common subsequence approach
  const maxLen = Math.max(origLines.length, refLines.length);
  const result: { type: 'same' | 'add' | 'remove'; text: string }[] = [];

  // Simple diff: walk through both, find common lines
  let oi = 0;
  let ri = 0;
  while (oi < origLines.length || ri < refLines.length) {
    if (oi < origLines.length && ri < refLines.length && origLines[oi] === refLines[ri]) {
      result.push({ type: 'same', text: origLines[oi] });
      oi++;
      ri++;
    } else {
      // Look ahead to find next match
      let foundOrig = -1;
      let foundRef = -1;
      for (let look = 1; look < 10 && look + oi < origLines.length; look++) {
        if (origLines[oi + look] === refLines[ri]) { foundOrig = look; break; }
      }
      for (let look = 1; look < 10 && look + ri < refLines.length; look++) {
        if (refLines[ri + look] === origLines[oi]) { foundRef = look; break; }
      }

      if (foundRef >= 0 && (foundOrig < 0 || foundRef <= foundOrig)) {
        // Lines were added in refined
        for (let k = 0; k < foundRef; k++) {
          result.push({ type: 'add', text: refLines[ri++] });
        }
      } else if (foundOrig >= 0) {
        // Lines were removed from original
        for (let k = 0; k < foundOrig; k++) {
          result.push({ type: 'remove', text: origLines[oi++] });
        }
      } else {
        // No nearby match — treat as replacement
        if (oi < origLines.length) result.push({ type: 'remove', text: origLines[oi++] });
        if (ri < refLines.length) result.push({ type: 'add', text: refLines[ri++] });
      }
    }

    // Safety: prevent infinite loop
    if (result.length > maxLen * 3) break;
  }

  return (
    <div style={{ fontSize: '0.78rem', fontFamily: "'SF Mono', monospace", lineHeight: 1.5 }}>
      {result.slice(0, 200).map((line, i) => (
        <div
          key={i}
          className={`pr-diff-line ${line.type === 'add' ? 'pr-diff-add' : line.type === 'remove' ? 'pr-diff-remove' : 'pr-diff-same'}`}
        >
          {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
          {line.text}
        </div>
      ))}
    </div>
  );
}
