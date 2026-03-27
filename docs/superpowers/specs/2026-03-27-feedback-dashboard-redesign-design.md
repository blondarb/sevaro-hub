# Feedback Dashboard Redesign — Multi-App Tab Navigation

**Date:** 2026-03-27
**Status:** Approved (pending implementation plan)

## Problem

The feedback dashboard at `/feedback` shows a flat list of all sessions across all apps. As the feedback widget is deployed to more Sevaro apps, this becomes unwieldy — there's no way to focus on a single app's feedback, no notification of new unreviewed items per app, and no way to analyze trends within or across apps.

## Goals

1. Per-app feedback triage with clear notification of unreviewed sessions
2. Lightweight inline stats per app without needing AI analysis
3. Scoped AI-powered analysis — per-app for fixing specific issues, cross-app for systemic trends
4. Minimal backend changes — client-side filtering of existing data

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Navigation model | Tab bar | Direct access, one click to any app |
| Tab population | Fixed list | See full portfolio at a glance, notice absent feedback |
| Badge meaning | Unreviewed count (`reviewStatus: open`) | Resets when feedback is actioned, not just viewed |
| Inline stats | Category chips (bugs/suggestions/confusion/praise) | Lightweight, no AI call, instant |
| Deep analysis | Separate page with scope selector | Heavy AI work isolated from browsing flow |
| Existing admin pages | Keep separate | Different workflows, avoid scope creep |
| Architecture | Client-side tabs (Approach A) | Fast tab switching, no new API endpoints, sufficient at current scale |

## Architecture

### Approach: Client-Side Tabs

Convert `/feedback` from a server component to a client component. One initial fetch loads all sessions via `listSessions()`, then filters client-side by `appId` when switching tabs.

**Why this over server-driven or hybrid:**
- Current volume (tens to low hundreds of sessions) fits comfortably in a single fetch
- Zero new API endpoints — reuses existing `listSessions()` from `feedback-api.ts`
- Instant tab switching with no network round-trips
- If volume grows to thousands, migrate to a hybrid approach with a counts endpoint

### Data Flow

`listSessions()` in `feedback-api.ts` calls the Lambda directly via `FEEDBACK_API_URL` (a server-only env var). Since we're converting to a client component, we need a thin server-side API route (`/api/feedback/sessions`) to proxy this call.

```
Page load → fetch('/api/feedback/sessions') → API route calls listSessions() → all sessions in state
  ↓
Tab click → filter sessions by appId → update displayed list
  ↓
Badge counts → computed from sessions where reviewStatus === 'open', grouped by appId
  ↓
Inline stats → computed from filtered sessions, grouped by category
```

## Page Structure: `/feedback`

### Global Stats Bar
Always visible at top. Shows aggregate counts across all apps:
- Total sessions
- Open (unreviewed) count
- Critical count
- Active apps count

### Tab Bar

Fixed horizontal tab bar below the stats:

| Tab | Label | Badge |
|-----|-------|-------|
| All | "All" | Total unreviewed count |
| evidence-engine | "Evidence Engine" | Unreviewed count for this app |
| opsample | "OPSAmple" | " |
| workouts | "Workouts" | " |
| showcase | "Showcase" | " |
| sevaro-scribe | "Scribe" | " |
| neuroscribe-extension | "NeuroScribe Ext" | " |
| repgenius | "RepGenius" | " |
| sevaro-monitor | "Monitor" | " |
| sevaro-hub | "Hub" | " |

- Red pill badge on tabs with unreviewed sessions (count > 0)
- "All" tab is the default
- Scrollable on mobile (overflow-x: auto)
- Active tab highlighted with bottom border accent

### Inline Category Chips
Below the tab bar, colored chips showing the count per category for the current tab's filtered sessions:
- Bugs (red)
- Suggestions (blue)
- Confusion (yellow)
- Praise (green)

### Session List
Same session card format as today, filtered to the active tab. When viewing a specific app tab, the appId badge is hidden from session cards (redundant).

### Header Actions
- "Analyze" link — navigates to `/feedback/analyze?app={currentTab}` (pre-scopes the analysis)
- "Hub" link — back to splash page

## Analysis Page: `/feedback/analyze`

### Changes from Current

The existing analysis page gains a **scope selector dropdown** in the controls row:

**Scope options:**
- "All Apps" — cross-app trend analysis (default if no `?app` param)
- Individual app names — scoped to that app's sessions only

**URL parameter:** `?app=evidence-engine` pre-selects scope when navigating from the dashboard.

### Per-App Analysis Mode
When scoped to a single app:
- Bedrock prompt filters sessions to that app
- Themes are app-specific (bugs, patterns, user pain points within that app)
- Recommendations are actionable for that specific codebase
- Summary references only that app's data

### Cross-App Analysis Mode ("All Apps")
When scoped to all apps:
- Bedrock prompt asks for patterns spanning multiple apps
- Outputs include:
  - **Cross-app patterns** — themes appearing in 2+ apps (e.g., "login confusion" across multiple products)
  - **Portfolio health** — which apps have highest severity, most feedback, or are suspiciously quiet
  - **Systemic recommendations** — improvements to apply across the board (shared UX patterns, common infrastructure fixes)
- The `affectedApps` field on each theme shows which apps are involved

### Bedrock Prompt Changes
The existing analysis prompt in `/api/feedback/analyze/route.ts` is modified to:
1. Accept an optional `appId` parameter in the POST body
2. Filter sessions by appId before sending to Bedrock (when scoped)
3. Use a different system prompt section for cross-app mode that asks for portfolio-level patterns
4. Return the same `AnalysisResult` shape — themes, summary, topPriority — with cross-app context when applicable

## App Registry

A shared constant `APP_TABS` defines the fixed tab list, reused by both the dashboard and analysis page:

```typescript
const APP_TABS = [
  { id: 'all', label: 'All' },
  { id: 'evidence-engine', label: 'Evidence Engine' },
  { id: 'opsample', label: 'OPSAmple' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'showcase', label: 'Showcase' },
  { id: 'sevaro-scribe', label: 'Scribe' },
  { id: 'neuroscribe-extension', label: 'NeuroScribe Ext' },
  { id: 'repgenius', label: 'RepGenius' },
  { id: 'sevaro-monitor', label: 'Monitor' },
  { id: 'sevaro-hub', label: 'Hub' },
];
```

This list is also used by the What's New admin page (`APP_OPTIONS`). Consider extracting to a shared config if not already centralized.

## Files to Modify

| File | Change |
|------|--------|
| `src/app/feedback/page.tsx` | Convert to client component with tab state, filtering, badges |
| `src/app/feedback/analyze/page.tsx` | Add scope selector dropdown, pass appId to API |
| `src/app/api/feedback/analyze/route.ts` | Accept appId param, filter sessions, adjust Bedrock prompt for cross-app vs single-app mode |
| New: `src/app/api/feedback/sessions/route.ts` | Thin proxy — calls `listSessions()` server-side, returns JSON to client |
| `src/lib/feedback-api.ts` | No changes needed — `listSessions()` already supports optional appId filter |
| New: `src/lib/app-registry.ts` | Shared APP_TABS constant |

## Out of Scope

- New API endpoints (badge counts, per-app sessions) — client-side filtering handles this
- Consolidating What's New / Improvements / Prompts into the dashboard
- Real-time updates / WebSocket notifications
- Multi-select app scoping in analysis (single app or all — not "these 3 apps")
- Admin user management for the dashboard

## Future Considerations

- If session volume grows past ~500, consider a lightweight `/api/feedback/counts` endpoint for badge data without fetching all sessions
- Multi-select scope in analysis (analyze 2-3 apps together)
- Trend visualization (charts showing feedback volume over time per app)
- Auto-triage: Bedrock automatically categorizes and routes new feedback to the right app's improvement queue
