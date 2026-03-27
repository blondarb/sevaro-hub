# Feedback Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the feedback dashboard with per-app tab navigation, unreviewed-count badges, inline category stats, and scoped AI analysis.

**Architecture:** Client-side tabs filter sessions loaded in a single fetch via a new thin API proxy route. The existing Bedrock analysis page gains a scope dropdown to analyze per-app or cross-app. A shared app registry constant avoids duplicating the app list.

**Tech Stack:** Next.js 15 App Router, React client components, AWS Bedrock (Claude Sonnet), existing Lambda feedback API

**Spec:** `docs/superpowers/specs/2026-03-27-feedback-dashboard-redesign-design.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `src/lib/app-registry.ts` | Shared `APP_TABS` constant and label lookup helper | Create |
| `src/app/api/feedback/sessions/route.ts` | Thin authenticated proxy to `listSessions()` for client components | Create |
| `src/app/feedback/page.tsx` | Client component with tab bar, badges, inline stats, filtered session list | Rewrite |
| `src/app/feedback/analyze/page.tsx` | Add scope selector dropdown, pass `appId` to API | Modify |
| `src/app/api/feedback/analyze/route.ts` | Accept `appId` param, filter sessions, dual Bedrock prompts (per-app vs cross-app) | Modify |
| `src/app/admin/whats-new/page.tsx` | Import `APP_TABS` from shared registry instead of local `APP_OPTIONS` | Modify |

---

### Task 1: Create Shared App Registry

**Files:**
- Create: `src/lib/app-registry.ts`

- [ ] **Step 1: Create the app registry file**

```typescript
// src/lib/app-registry.ts

export interface AppTab {
  id: string;
  label: string;
}

export const APP_TABS: AppTab[] = [
  { id: 'all', label: 'All' },
  { id: 'evidence-engine', label: 'Evidence Engine' },
  { id: 'opsample', label: 'OPSAmple' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'showcase', label: 'Showcase' },
  { id: 'neuroscribe-extension', label: 'NeuroScribe Ext' },
  { id: 'sevaro-scribe', label: 'Scribe' },
  { id: 'repgenius', label: 'RepGenius' },
  { id: 'sevaro-monitor', label: 'Monitor' },
  { id: 'sevaro-hub', label: 'Hub' },
];

/** App tabs excluding the "all" entry — for dropdowns and filters that need real app IDs */
export const APP_LIST = APP_TABS.filter((t) => t.id !== 'all');

/** Look up display label for an appId. Returns the raw appId if not found. */
export function getAppLabel(appId: string): string {
  return APP_TABS.find((t) => t.id === appId)?.label ?? appId;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-registry.ts
git commit -m "feat: add shared app registry constant for feedback tabs"
```

---

### Task 2: Create Sessions Proxy API Route

The current `listSessions()` uses `FEEDBACK_API_URL` (server-only env var). The dashboard is becoming a client component, so it needs a server-side proxy to call `listSessions()`.

**Files:**
- Create: `src/app/api/feedback/sessions/route.ts`

- [ ] **Step 1: Create the proxy route**

```typescript
// src/app/api/feedback/sessions/route.ts
import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { listSessions } from '@/lib/feedback-api';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('Failed to list sessions:', err);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/feedback/sessions/route.ts
git commit -m "feat: add /api/feedback/sessions proxy for client-side session fetch"
```

---

### Task 3: Rewrite Feedback Dashboard with Tab Navigation

Convert the server component at `src/app/feedback/page.tsx` to a client component with tab bar, badges, inline category chips, and filtered session list. This is the largest task — the complete rewrite of the page.

**Files:**
- Rewrite: `src/app/feedback/page.tsx`

**Key behaviors:**
- On mount, fetch all sessions via `/api/feedback/sessions` with Bearer token
- Compute badge counts per app from `reviewStatus === 'open'` (or missing `reviewStatus`)
- Filter sessions by `activeTab` appId (or show all when tab is `'all'`)
- Show inline category chips for the filtered set
- Hide appId badge on session cards when viewing a specific app tab
- "Analyze" link passes `?app={activeTab}` to the analyze page

- [ ] **Step 1: Rewrite the page**

```typescript
// src/app/feedback/page.tsx
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
  const rs = (session as unknown as Record<string, unknown>).reviewStatus as string | undefined;
  return !rs || rs === 'open';
}

export default function FeedbackDashboard() {
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

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

  // Badge counts per app (unreviewed sessions)
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

  // Filtered sessions for current tab
  const filtered = useMemo(() => {
    if (activeTab === 'all') return sessions;
    return sessions.filter((s) => s.appId === activeTab);
  }, [sessions, activeTab]);

  // Category counts for inline chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filtered) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [filtered]);

  // Global stats
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
        {/* Header */}
        <div className="fb-header">
          <h1>Feedback Dashboard</h1>
          <div className="fb-header-links">
            <Link href={analyzeHref}>Analyze</Link>
            <span>|</span>
            <Link href="/">&larr; Hub</Link>
          </div>
        </div>

        {error && <div className="fb-error">{error}</div>}

        {/* Global Stats */}
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

        {/* Tab Bar */}
        <div className="fb-tabs">
          {APP_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`fb-tab ${activeTab === tab.id ? 'fb-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {(badgeCounts[tab.id] || 0) > 0 && (
                <span className="fb-tab-badge">{badgeCounts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Inline Category Chips */}
        {!loading && filtered.length > 0 && (
          <div className="fb-chips">
            {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => {
              const count = categoryCounts[cat] || 0;
              if (count === 0) return null;
              return (
                <div
                  key={cat}
                  className="fb-chip"
                  style={{ background: colors.bg, border: `1px solid ${colors.text}30` }}
                >
                  <span style={{ color: colors.text, fontWeight: 600 }}>{count}</span>{' '}
                  <span style={{ color: '#8890a4' }}>{cat}{count !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Session List */}
        {loading ? (
          <div className="fb-empty"><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="fb-empty">
            <p>{activeTab === 'all' ? 'No feedback sessions yet' : `No feedback for ${getAppLabel(activeTab)}`}</p>
            <span>Sessions will appear here when users submit feedback via the widget</span>
          </div>
        ) : (
          filtered.map((session) => {
            const cat = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.suggestion;
            const statusInfo = STATUS_LABELS[session.status] || STATUS_LABELS.submitted;
            const actionItems = Array.isArray(session.actionItems) ? session.actionItems : [];
            const date = session.createdAt
              ? new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : '';
            const rs = REVIEW_STATUS_STYLES[(session as unknown as Record<string, unknown>).reviewStatus as string] || REVIEW_STATUS_STYLES.open;

            return (
              <Link
                key={session.sessionId}
                href={`/feedback/${session.sessionId}?appId=${session.appId}`}
                className="fb-session"
              >
                <div className="fb-session-top">
                  {/* Only show appId badge on the "All" tab */}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npm run dev`

Verify in browser at `http://localhost:3000/feedback`:
1. Page loads with "Loading..." then shows sessions
2. Global stats bar shows correct counts
3. Tab bar shows all 10 tabs (All + 9 apps)
4. Red badges appear on tabs with unreviewed sessions
5. Clicking a tab filters the session list to that app
6. Category chips update to reflect filtered data
7. AppId badge hidden on session cards when viewing a specific app tab
8. "Analyze" link updates href when switching tabs
9. Empty state shows when an app has no sessions

- [ ] **Step 4: Commit**

```bash
git add src/app/feedback/page.tsx
git commit -m "feat: rewrite feedback dashboard with per-app tab navigation and badges"
```

---

### Task 4: Add Scope Selector to Analysis Page

Modify the existing analysis page to accept an `?app` URL parameter and add a scope dropdown.

**Files:**
- Modify: `src/app/feedback/analyze/page.tsx`

- [ ] **Step 1: Update the analysis page**

Add these changes to `src/app/feedback/analyze/page.tsx`:

1. Import `APP_TABS` from `@/lib/app-registry`
2. Import `useSearchParams` from `next/navigation` and `Suspense` from `react`
3. Add `appScope` state initialized from `searchParams.get('app') || 'all'`
4. Add scope dropdown before the time range selector
5. Pass `appScope` in the `fetch` body as `appId` (only when not `'all'`)
6. Wrap the inner component with `<Suspense>` (required for `useSearchParams` in Next.js 15)

Replace the component with:

```typescript
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getIdToken } from '@/lib/auth';
import { APP_TABS } from '@/lib/app-registry';

interface Theme {
  name: string;
  description: string;
  frequency: number;
  severity: 'critical' | 'major' | 'minor';
  affectedApps: string[];
  relatedSessionIds: string[];
  recommendation: string;
}

interface AnalysisResult {
  themes: Theme[];
  summary: string;
  topPriority: string;
  sessionCount: number;
  analyzedDays: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
};

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const searchParams = useSearchParams();
  const initialApp = searchParams.get('app') || 'all';

  const [appScope, setAppScope] = useState(initialApp);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated — please sign in again');

      const body: Record<string, unknown> = { days };
      if (appScope !== 'all') body.appId = appScope;

      const res = await fetch('/api/feedback/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Analysis failed: ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e8',
    fontSize: '0.85rem',
    outline: 'none' as const,
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      maxWidth: 1000,
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      background: '#0a0a0f',
      color: '#e0e0e8',
      minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 700,
          background: 'linear-gradient(135deg, #c8d8f0, #7aa2d4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Feedback Pattern Analysis
        </h1>
        <Link href="/feedback" style={{ color: '#7aa2d4', textDecoration: 'none', fontSize: '0.9rem' }}>
          &larr; Dashboard
        </Link>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap',
      }}>
        <select
          value={appScope}
          onChange={(e) => setAppScope(e.target.value)}
          style={selectStyle}
        >
          {APP_TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.id === 'all' ? 'All Apps (cross-app trends)' : tab.label}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: loading ? '#3a4560' : '#7aa2d4', color: '#fff',
            fontSize: '0.85rem', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: 16, borderRadius: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#5a6580' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>Analyzing feedback patterns with AI...</p>
          <p style={{ fontSize: '0.85rem' }}>This may take 10-15 seconds</p>
        </div>
      )}

      {result && (
        <>
          {/* Summary */}
          <div style={{
            background: 'rgba(122,162,212,0.05)', border: '1px solid rgba(122,162,212,0.15)',
            borderRadius: 12, padding: '18px 20px', marginBottom: 24,
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aa2d4', marginBottom: 8 }}>
              Summary ({result.sessionCount} sessions, last {result.analyzedDays} days)
            </div>
            <p style={{ color: '#c0c8d8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 12 }}>{result.summary}</p>
            {result.topPriority && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171', textTransform: 'uppercase' }}>Top Priority: </span>
                <span style={{ color: '#d0d8e8', fontSize: '0.88rem' }}>{result.topPriority}</span>
              </div>
            )}
          </div>

          {/* Themes */}
          {result.themes.map((theme, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '18px 20px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 4,
                  background: `${SEVERITY_COLORS[theme.severity]}20`,
                  color: SEVERITY_COLORS[theme.severity],
                }}>
                  {theme.severity}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#5a6580' }}>
                  {theme.frequency} session{theme.frequency !== 1 ? 's' : ''}
                </span>
                {theme.affectedApps.map((app) => (
                  <span key={app} style={{
                    fontSize: '0.6rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(60,160,240,0.15)', color: '#60a5fa',
                  }}>
                    {app}
                  </span>
                ))}
              </div>
              <h3 style={{ color: '#d0d8e8', fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
                {theme.name}
              </h3>
              <p style={{ color: '#8890a4', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 10 }}>
                {theme.description}
              </p>
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(34,197,94,0.05)', borderLeft: '3px solid #10b981',
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4ade80', textTransform: 'uppercase' }}>Recommendation: </span>
                <span style={{ color: '#b0b8c8', fontSize: '0.85rem' }}>{theme.recommendation}</span>
              </div>
            </div>
          ))}

          {result.themes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#5a6580' }}>
              No significant patterns found in the selected time period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/feedback/analyze/page.tsx
git commit -m "feat: add app scope selector to feedback analysis page"
```

---

### Task 5: Update Analysis API Route for Scoped Prompts

Modify the Bedrock analysis route to accept an optional `appId`, filter sessions accordingly, and use different prompts for per-app vs cross-app analysis.

**Files:**
- Modify: `src/app/api/feedback/analyze/route.ts`

- [ ] **Step 1: Update the route handler**

Replace the full content of `src/app/api/feedback/analyze/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { listSessions } from '@/lib/feedback-api';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-2' });

export async function POST(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const body = await request.json();
  const days = body.days || 30;
  const appId: string | undefined = body.appId; // undefined = cross-app mode

  try {
    const sessions = await listSessions();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let unresolvedSessions = sessions.filter((s) => {
      const isRecent = s.createdAt >= cutoff;
      const isUnresolved = !s.reviewStatus || s.reviewStatus === 'open' || s.reviewStatus === 'in_progress';
      return isRecent && isUnresolved;
    });

    // Filter by app if scoped
    if (appId) {
      unresolvedSessions = unresolvedSessions.filter((s) => s.appId === appId);
    }

    if (unresolvedSessions.length === 0) {
      return NextResponse.json({
        themes: [],
        summary: appId
          ? `No unresolved feedback sessions for ${appId} in the last ${days} days.`
          : `No unresolved feedback sessions found in the last ${days} days.`,
        topPriority: '',
        sessionCount: 0,
        analyzedDays: days,
      });
    }

    const sessionSummaries = unresolvedSessions.map((s) => {
      const actionItems = Array.isArray(s.actionItems) ? s.actionItems : [];
      return {
        sessionId: s.sessionId,
        app: s.appId,
        category: s.category,
        date: s.createdAt,
        user: s.userLabel || 'Anonymous',
        summary: s.aiSummary || s.transcript?.slice(0, 300) || 'No summary',
        actionItems: actionItems.map((a) => ({
          type: a.type,
          title: a.title,
          description: a.description,
          severity: a.severity,
          pages: a.affectedPages,
        })),
      };
    });

    const prompt = appId
      ? buildPerAppPrompt(sessionSummaries, days, appId)
      : buildCrossAppPrompt(sessionSummaries, days);

    const converseResponse = await bedrock.send(new ConverseCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6-20250514-v1:0',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 2000, temperature: 0.2 },
    }));

    const responseText = converseResponse.output?.message?.content?.[0]?.text || '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse analysis', raw: responseText }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ...analysis,
      sessionCount: unresolvedSessions.length,
      analyzedDays: days,
    });
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json(
      { error: 'Analysis failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

function buildPerAppPrompt(
  sessionSummaries: Record<string, unknown>[],
  days: number,
  appId: string,
): string {
  return `Analyze these ${sessionSummaries.length} unresolved feedback sessions from the last ${days} days for the "${appId}" app. Identify bugs, patterns, recurring user pain points, and suggest prioritized actions specific to this app.

FEEDBACK DATA:
${JSON.stringify(sessionSummaries, null, 2)}

Respond with JSON in this exact format:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme covers",
      "frequency": <number of sessions mentioning this>,
      "severity": "critical" | "major" | "minor",
      "affectedApps": ["${appId}"],
      "relatedSessionIds": ["id1", "id2"],
      "recommendation": "Specific actionable fix for this app"
    }
  ],
  "summary": "1-2 sentence summary of this app's feedback patterns",
  "topPriority": "Single most impactful thing to fix in this app"
}`;
}

function buildCrossAppPrompt(
  sessionSummaries: Record<string, unknown>[],
  days: number,
): string {
  return `Analyze these ${sessionSummaries.length} unresolved feedback sessions from the last ${days} days across multiple Sevaro apps. Focus on:

1. CROSS-APP PATTERNS: Issues or themes that appear in 2+ different apps (e.g., "login confusion" across multiple products). These are the most valuable findings.
2. PORTFOLIO HEALTH: Which apps have the most feedback, highest severity, and which are suspiciously quiet.
3. SYSTEMIC RECOMMENDATIONS: Improvements that should be applied across the board — shared UX patterns, common infrastructure fixes, design consistency issues.

FEEDBACK DATA:
${JSON.stringify(sessionSummaries, null, 2)}

Respond with JSON in this exact format:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme covers and which apps are affected",
      "frequency": <number of sessions mentioning this>,
      "severity": "critical" | "major" | "minor",
      "affectedApps": ["app1", "app2"],
      "relatedSessionIds": ["id1", "id2"],
      "recommendation": "What to do about it across the portfolio"
    }
  ],
  "summary": "1-2 sentence portfolio-level summary highlighting cross-app patterns",
  "topPriority": "Single most impactful systemic improvement"
}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/feedback/analyze/route.ts
git commit -m "feat: add per-app and cross-app analysis modes to Bedrock prompt"
```

---

### Task 6: Migrate What's New Page to Shared Registry

Replace the local `APP_OPTIONS` in the What's New admin page with the shared `APP_TABS` from the registry.

**Files:**
- Modify: `src/app/admin/whats-new/page.tsx`

- [ ] **Step 1: Update imports and replace APP_OPTIONS**

In `src/app/admin/whats-new/page.tsx`:

1. Add import at the top:
```typescript
import { APP_LIST } from '@/lib/app-registry';
```

2. Replace the local `APP_OPTIONS` constant (lines 14-25) with:
```typescript
const APP_OPTIONS = [
  { value: 'all', label: 'All Apps' },
  ...APP_LIST.map((t) => ({ value: t.id, label: t.label })),
];
```

This keeps the `{ value, label }` shape the existing code expects while deriving from the shared registry.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify What's New admin page still works**

Open `http://localhost:3000/admin/whats-new` and verify:
1. App dropdown in the create form still shows all apps
2. Filter dropdown still works
3. Existing entries still display correctly

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/whats-new/page.tsx
git commit -m "refactor: use shared app registry in What's New admin page"
```

---

### Task 7: Final Integration Test and Cleanup

**Files:** None (testing only)

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: End-to-end smoke test**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npm run dev`

Test the full flow:
1. Navigate to `/feedback` — tabs load with correct badges
2. Click through several app tabs — filtering works, badges correct
3. Click "Analyze" from a specific app tab — lands on `/feedback/analyze?app=<appId>` with scope pre-selected
4. Click "Analyze" from "All" tab — lands on `/feedback/analyze` with "All Apps" selected
5. Run an analysis with a specific app scope — results reference only that app
6. Run an analysis with "All Apps" scope — results include cross-app patterns
7. Navigate to `/admin/whats-new` — app dropdowns work correctly
8. Navigate back to `/feedback` — page loads without errors

- [ ] **Step 3: Build check**

Run: `cd /Users/stevearbogast/dev/repos/sevaro-hub && npm run build`
Expected: Build succeeds with no errors
