'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getIdToken } from '@/lib/auth';
import type { WhatsNewEntry } from '@/lib/whats-new-api';
import {
  getAllUpdates,
  createUpdate,
  deleteUpdate,
} from '@/lib/whats-new-api';

const APP_OPTIONS = [
  { value: 'all', label: 'All Apps' },
  { value: 'sevaro-hub', label: 'Sevaro Hub' },
  { value: 'evidence-engine', label: 'Evidence Engine' },
  { value: 'opsample', label: 'OPSAmple' },
  { value: 'workouts', label: 'Workouts' },
  { value: 'showcase', label: 'GitHub Showcase' },
  { value: 'neuroscribe-extension', label: 'NeuroScribe Extension' },
  { value: 'sevaro-scribe', label: 'Sevaro Scribe' },
  { value: 'repgenius', label: 'RepGenius' },
  { value: 'sevaro-monitor', label: 'Sevaro Monitor' },
];

const CATEGORY_OPTIONS = [
  { value: 'fix', label: 'Fix', color: '#f87171' },
  { value: 'feature', label: 'Feature', color: '#4ade80' },
  { value: 'improvement', label: 'Improvement', color: '#60a5fa' },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  fix: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  feature: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
  improvement: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
};

export default function WhatsNewAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [updates, setUpdates] = useState<WhatsNewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formAppId, setFormAppId] = useState('all');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<'fix' | 'feature' | 'improvement'>('improvement');
  const [formVersion, setFormVersion] = useState('');
  const [formLink, setFormLink] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      const data = await getAllUpdates(token);
      setUpdates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      await createUpdate(
        {
          appId: formAppId,
          title: formTitle,
          description: formDescription,
          category: formCategory,
          ...(formVersion && { version: formVersion }),
          ...(formLink && { link: formLink }),
        },
        token,
      );
      // Reset form
      setFormTitle('');
      setFormDescription('');
      setFormVersion('');
      setFormLink('');
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(appId: string, timestamp: string) {
    if (!confirm('Delete this update?')) return;
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      await deleteUpdate(appId, timestamp, token);
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

  const filtered = filterApp
    ? updates.filter((u) => u.appId === filterApp)
    : updates;

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; }
        .wn-container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
        .wn-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .wn-header h1 { font-size: 1.6rem; font-weight: 700; background: linear-gradient(135deg, #c8d8f0, #7aa2d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .wn-back { color: #7aa2d4; text-decoration: none; font-size: 0.9rem; }
        .wn-back:hover { text-decoration: underline; }
        .wn-toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .wn-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; color: #d0d8e8; font-size: 0.82rem; font-family: inherit; }
        .wn-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(122,162,212,0.3); background: rgba(122,162,212,0.1); color: #7aa2d4; font-size: 0.82rem; cursor: pointer; font-family: inherit; font-weight: 500; }
        .wn-btn:hover { background: rgba(122,162,212,0.2); }
        .wn-btn-danger { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #f87171; }
        .wn-btn-danger:hover { background: rgba(239,68,68,0.15); }
        .wn-form { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
        .wn-form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .wn-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; color: #d0d8e8; font-size: 0.85rem; font-family: inherit; flex: 1; min-width: 200px; }
        .wn-input:focus { outline: none; border-color: rgba(122,162,212,0.4); }
        .wn-textarea { resize: vertical; min-height: 60px; }
        .wn-label { display: block; font-size: 0.72rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .wn-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; }
        .wn-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .wn-badge { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 3px; }
        .wn-card-title { font-size: 0.88rem; font-weight: 500; color: #d0d8e8; }
        .wn-card-desc { font-size: 0.8rem; color: #8890a4; line-height: 1.4; margin-top: 4px; }
        .wn-card-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 0.72rem; color: #5a6580; align-items: center; }
        .wn-empty { text-align: center; padding: 40px; color: #5a6580; font-size: 0.9rem; }
        .wn-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 10px 14px; color: #f87171; margin-bottom: 16px; font-size: 0.85rem; }
        .wn-stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .wn-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; }
        .wn-stat-value { font-size: 1.4rem; font-weight: 700; color: #d0d8e8; }
        .wn-stat-label { font-size: 0.7rem; color: #5a6580; text-transform: uppercase; letter-spacing: 0.06em; }
      `}</style>

      <div className="wn-container">
        <div className="wn-header">
          <h1>What&apos;s New — Admin</h1>
          <Link href="/" className="wn-back">&larr; Hub</Link>
        </div>

        {error && <div className="wn-error">{error}</div>}

        {/* Stats */}
        <div className="wn-stats">
          <div className="wn-stat">
            <div className="wn-stat-value">{updates.length}</div>
            <div className="wn-stat-label">Total</div>
          </div>
          <div className="wn-stat">
            <div className="wn-stat-value">{updates.filter((u) => u.category === 'fix').length}</div>
            <div className="wn-stat-label">Fixes</div>
          </div>
          <div className="wn-stat">
            <div className="wn-stat-value">{updates.filter((u) => u.category === 'feature').length}</div>
            <div className="wn-stat-label">Features</div>
          </div>
          <div className="wn-stat">
            <div className="wn-stat-value">{new Set(updates.map((u) => u.appId)).size}</div>
            <div className="wn-stat-label">Apps</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="wn-toolbar">
          <select
            className="wn-select"
            value={filterApp}
            onChange={(e) => setFilterApp(e.target.value)}
          >
            <option value="">All apps</option>
            {APP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="wn-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Update'}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form className="wn-form" onSubmit={handleCreate}>
            <div className="wn-form-row">
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="wn-label">App</label>
                <select className="wn-select" style={{ width: '100%' }} value={formAppId} onChange={(e) => setFormAppId(e.target.value)}>
                  {APP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="wn-label">Category</label>
                <select className="wn-select" style={{ width: '100%' }} value={formCategory} onChange={(e) => setFormCategory(e.target.value as 'fix' | 'feature' | 'improvement')}>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="wn-form-row">
              <div style={{ flex: 1 }}>
                <label className="wn-label">Title</label>
                <input className="wn-input" type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Fixed dot phrase expansion" />
              </div>
            </div>
            <div className="wn-form-row">
              <div style={{ flex: 1 }}>
                <label className="wn-label">Description</label>
                <textarea className="wn-input wn-textarea" required value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Dot phrases now expand correctly in all text fields." />
              </div>
            </div>
            <div className="wn-form-row">
              <div style={{ flex: 1, minWidth: 120 }}>
                <label className="wn-label">Version (optional)</label>
                <input className="wn-input" type="text" value={formVersion} onChange={(e) => setFormVersion(e.target.value)} placeholder="1.2.0" />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label className="wn-label">Link (optional)</label>
                <input className="wn-input" type="url" value={formLink} onChange={(e) => setFormLink(e.target.value)} placeholder="https://docs.example.com/changelog" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="wn-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="wn-btn" disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creating...' : 'Create Update'}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="wn-empty">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="wn-empty">
            {filterApp ? `No updates for ${filterApp}` : 'No updates yet. Create one above.'}
          </div>
        ) : (
          filtered.map((entry) => {
            const cat = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.improvement;
            const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
            const appLabel = APP_OPTIONS.find((o) => o.value === entry.appId)?.label || entry.appId;

            return (
              <div key={`${entry.appId}-${entry.timestamp}`} className="wn-card">
                <div className="wn-card-top">
                  <span className="wn-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>
                    {appLabel}
                  </span>
                  <span className="wn-badge" style={{ background: cat.bg, color: cat.text }}>
                    {entry.category}
                  </span>
                  {entry.version && (
                    <span style={{ fontSize: '0.7rem', color: '#5a6580' }}>v{entry.version}</span>
                  )}
                  <span className="wn-card-title" style={{ marginLeft: 4 }}>
                    {entry.title}
                  </span>
                </div>
                <div className="wn-card-desc">{entry.description}</div>
                <div className="wn-card-meta">
                  <span>{date}</span>
                  {entry.createdBy && <span>by {entry.createdBy}</span>}
                  {entry.link && (
                    <a
                      href={entry.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#7aa2d4', textDecoration: 'none' }}
                    >
                      Link &rarr;
                    </a>
                  )}
                  <button
                    className="wn-btn wn-btn-danger"
                    style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.7rem' }}
                    onClick={() => handleDelete(entry.appId, entry.timestamp)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
