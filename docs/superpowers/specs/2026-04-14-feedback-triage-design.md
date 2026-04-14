# Feedback Triage & Analysis Redesign

**Date:** 2026-04-14
**Status:** Design, awaiting spec review
**Owner:** steve@sevaro.com
**Related:** `sevaro-improvement-queue-api`, `sevaro-feedback-api`, `/improvement-queue` skill

---

## Summary

Build a semi-automated feedback loop on top of the existing `sevaro-feedback-api` and `sevaro-improvement-queue-api` infrastructure. When users submit feedback from Sevaro apps (Evidence Engine, Hub, OPSAmple, etc.), a local Claude Code skill triages unreviewed sessions using Bedrock Sonnet 4.6: it classifies each session, maps it to suspected code in the appropriate repo, assigns a theme, and drafts a Claude Code fix prompt. The Hub's `/feedback/triage` admin page shows the resulting proposal queue for human review. Each proposal can be approved (sends the fix prompt to the existing improvement queue), rejected with a structured reason (feeds theme-level re-surfacing data), or refined conversationally (the reviewer tells Bedrock what to change about the prompt instead of editing text by hand). The existing broken `/feedback/analyze` endpoint is replaced with a theme-view page that groups all feedback by pre-computed `themeId`, shows vote counts, status breakdowns, and flags themes that are accumulating new votes after prior denials.

## Goals

- **Close the loop** between user feedback and fix prompts in the improvement queue without hand-curation
- **Preserve human control.** Agents validate and draft, humans approve. No proposal auto-executes.
- **Make denial durable.** Rejected proposals contribute to theme-level vote tracking so recurring complaints re-surface with context.
- **Minimize new infrastructure.** Reuse the existing feedback API, improvement queue API, and Cognito auth. Add one small DynamoDB table and one new skill.
- **Fix `/feedback/analyze`** by replacing its brittle one-shot Bedrock pattern-clustering with a query over pre-computed theme data.
- **Prompt refinement by instruction, not edit.** Reviewers describe changes in plain English; Bedrock rewrites the prompt; revisions are preserved.

## Non-goals (explicit out-of-scope for v1)

- **No red alert banner** on `/feedback/analyze` for re-surfacing themes. Visual flag on the theme card is sufficient.
- **No auto-reopen** of denied proposals when their theme crosses a vote threshold. That's a follow-up.
- **No browser replay / live repro** of user sessions. Validation is LLM-based over session artifacts + codebase grep.
- **No Slack / email / ntfy notifications** when triage completes or thresholds are crossed. Explicit button click in Hub, explicit skill invocation in terminal.
- **No auto-spawn of Claude Code sessions on approval.** Approved fix prompts go into the existing `sevaro-improvement-queue`, and the existing `/improvement-queue` skill executes them on demand.
- **No theme-slug deduplication logic** (e.g., collapsing `fonts-too-small` and `font-size-issues` into one). The skill uses an existing-theme menu to prevent drift at classification time; cleanup of stale themes is a later concern.
- **Multi-admin** management page. Single-admin for now; `ADMIN_EMAILS` env var continues to be the gate.

## Current state

### What exists
- `sevaro-hub` Next.js 15 app on Amplify (`d3n3e9vr1knkam`), domain `hub.neuroplans.app`
- `sevaro-feedback-api` Lambda via API Gateway `8uagz9y5bh` — DynamoDB storage for sessions, S3 bucket `sevaro-feedback-recordings` for audio
- `sevaro-improvement-queue-api` Lambda via API Gateway `ael0orzmsk` — DynamoDB table `sevaro-improvement-queue` (PK `repoName`, SK `promptId`)
- `/feedback` — list view of sessions, existing
- `/feedback/[id]` — session detail view, existing, server-side auth gated
- `/feedback/analyze` — **broken** pattern-analysis endpoint at `src/app/api/feedback/analyze/route.ts`
- Cognito auth (`us-east-2_9y6XyJnXC`) verified via JWKS in `src/lib/verify-auth.ts`; `ADMIN_EMAILS` allowlist
- `/improvement-queue` skill that browses and executes pending prompts across Sevaro repos

### What's broken
`/feedback/analyze` fails because of a combination of:
- Brittle JSON extraction (`match(/\{[\s\S]*\}/)`) that fails when Claude returns markdown code fences or leading/trailing text
- Swallowed Bedrock error details — client sees generic "Analysis failed" with no diagnostic
- Hard-coded region and model ID with no verification that the Amplify SSR IAM role has `bedrock:InvokeModel` on `us.anthropic.claude-sonnet-4-6` inference profile
- Results are not persisted — every click triggers a fresh expensive re-clustering of all open sessions

The page is not repaired in this project. It is **replaced** with a fundamentally different implementation: query the decision log for pre-computed themes and render them. See the `/feedback/analyze` component below.

## Architecture

### Approach: Proposal-on-session + append-only decision log

Each feedback session in DynamoDB gets a new optional field:

```json
{
  "sessionId": "a3f2...",
  "reviewStatus": "open" | "in_progress" | "resolved" | "rejected",
  "triageProposal": {
    "version": 2,
    "createdAt": "2026-04-14T10:22:00Z",
    "classification": "real_bug" | "confused_user" | "duplicate" | "out_of_scope" | "needs_info",
    "confidence": 0.92,
    "themeId": "fonts-too-small",
    "suspectedRepo": "sevaro-evidence-engine",
    "suspectedFiles": [
      { "path": "chrome-extension/components/DosingCard.tsx", "line": 42, "excerpt": "<span className=\"text-sm text-gray-700\">{dosing.mg} mg</span>" },
      { "path": "chrome-extension/styles/tokens.css", "line": 18, "excerpt": "--text-body: 14px;" }
    ],
    "rationale": "Rating of 2 stars + explicit readability complaint + dosing context...",
    "revisions": [
      { "version": 1, "prompt": "...", "instruction": null, "createdAt": "..." },
      { "version": 2, "prompt": "...", "instruction": "also check contrast on cards that use --text-body, no tests", "createdAt": "..." }
    ]
  }
}
```

A **new append-only DynamoDB table `sevaro-feedback-triage-history`** records every triage action:

```
PK: sessionId (string)
SK: timestamp (ISO 8601 string)

Attributes:
  action: "proposed" | "approved" | "rejected" | "refined" | "reverted"
  proposalSnapshot: <full proposal object at time of action>
  themeId: string
  reviewerEmail: string (from JWT)
  reviewerNotes: string (optional)
  rejectionReason: "not_a_real_issue" | "already_fixed" | "low_priority" | "duplicate" | "out_of_scope" | "need_more_info" (on reject only)
  improvementQueueItemId: string (on approve only)
```

This table is the substrate for theme-level vote tracking and the `/feedback/analyze` theme view. It is append-only; nothing is deleted.

A second small **DynamoDB table `sevaro-feedback-triage-requests`** holds explicit Run-Triage button clicks so the skill can pick them up on its next run:

```
PK: requestId (string, UUID)

Attributes:
  requestedBy: string (reviewer email from JWT)
  requestedAt: ISO 8601 string
  sessionIds: string[] (the pending session IDs snapshotted at click time)
  status: "pending" | "processing" | "done" | "expired"
  processedCount: number (set when status=done)
  ttl: number (epoch seconds, 72h from requestedAt, DynamoDB TTL-cleaned)
```

Rows are cleaned up automatically after 72 hours via DynamoDB TTL. If the user clicks Run Triage but never runs the skill, the request expires without side effects.

### Three layers

**Layer 1 — Decision log** (`sevaro-feedback-triage-history` table). Every proposed / approved / rejected / refined / reverted action writes a row. Cheap, foundational, never deletes.

**Layer 2 — Theme classification at triage time.** The `/triage-feedback` skill fetches the current set of known themes from the history table (distinct `themeId` values), passes them to Bedrock as a menu during classification, and lets Claude either pick an existing theme or propose a new one. This prevents slug drift without requiring after-the-fact clustering.

**Layer 3 — Theme grouping on `/feedback/analyze`.** The page queries the history table, groups rows by `themeId`, computes vote counts / status breakdowns / trends, and renders. Themes where a prior denial has new votes since its denial timestamp get a subtle red outline and a chip. No alert banner (explicit non-goal for v1).

## Components

### 1. Replace `/feedback/analyze` endpoint

**File:** `src/app/api/feedback/analyze/route.ts`

New implementation queries `sevaro-feedback-triage-history` (via a new Lambda API endpoint we'll add to `sevaro-feedback-api`) and returns:

```typescript
type ThemesResponse = {
  timeRange: { from: string; to: string }
  stats: {
    totalSessions: number
    totalThemes: number
    trendingUp: number
    newVotesSinceDenial: number
    awaitingTriage: number
  }
  themes: Array<{
    themeId: string
    description: string
    voteCount: number
    apps: string[]
    statusBreakdown: { approved: number; open: number; rejected: number }
    weeklyTrend: number[]  // 6 buckets
    trending: boolean  // true if vote growth > threshold
    newVotesSinceDenial: number  // 0 if never denied; N if denied and has N post-denial votes
    lastActivityAt: string
  }>
}
```

Accepts query params: `days`, `appId`, `sort=votes|trending|recent|resurfacing`.

Removes: the old Bedrock call, brittle JSON regex, hard-coded model ID in business logic.

### 2. New skill: `/triage-feedback`

**Location:** `~/.claude/skills/triage-feedback/` or `~/dev/repos/.claude/skills/triage-feedback/` depending on preferred scope.

**Flow:**
1. Fetch current admin auth token from the hub (via env var or shared config)
2. `GET /api/feedback/triage-requests?status=pending` — check for explicit button-triggered requests
3. **Determine the session list:**
   - If one or more pending triage-requests exist, use the union of their `sessionIds` arrays as the list to process, and mark each request `status=processing`
   - Otherwise (no pending requests), fall back to `GET /api/feedback/sessions?reviewStatus=open&hasProposal=false` and process any untriaged open sessions
4. `GET /api/feedback/themes` — fetch existing theme menu (distinct `themeId` values from history)
5. For each session in the list:
   a. Build prompt: session transcript + screenshots context + user agent + existing theme menu
   b. Call Bedrock Sonnet 4.6 with structured output schema demanding `{ classification, confidence, themeId, rationale, suspectedRepo, suspectedFiles, draftPrompt }`
   c. If `suspectedRepo` is set, grep the local repo for the files; for each hit, read 20 lines of context and include as `excerpt`
   d. `PATCH /api/feedback/[id]` with the new `triageProposal` field (version 1)
   e. `POST /api/feedback/triage-history` with `action=proposed` and proposal snapshot
6. If any triage-requests were picked up in step 3, `PATCH /api/feedback/triage-requests/[id]` → `status=done` with a processed count
7. Print a summary: `N sessions triaged → M proposals, K themes touched (J existing, L new)`. If the run was triggered by explicit requests, note how many.

The skill runs locally from `~/dev/repos` so it has read access to all Sevaro repos for the grep step.

### 3. Hub UI: `/feedback/triage`

**Files:** `src/app/feedback/triage/page.tsx`, `src/app/feedback/triage/TriageClient.tsx`, plus subcomponents.

**Pattern:** list + detail (mockup variant B, approved).

Layout:
- Top toolbar — page title, pending count badge, Pending/Approved/Rejected segmented control, **Run Triage** button
- Left pane (340px fixed) — search input + keyboard-navigable list of sessions with pending proposals. Each row: colored left border (classification), session short-id, app name, age, excerpt, classification badge, theme chip
- Right pane (flex) — tabs (Proposal / Original session / History), feedback excerpt, agent classification card with confidence meter, theme chip (clickable → popover showing all sessions with same theme), suggested files with line numbers + context, draft prompt (dark code block), refine-prompt panel (always visible), revision history (expandable), sticky action bar (Reject… / Edit prompt / Approve →)

**Keyboard:** ↑↓ navigates list; A/E/R fires approve/edit/reject on the selected item.

**Run Triage button** (clarification from Q&A): explicit trigger that kicks off the local skill via shared state:

1. Click calls `POST /api/feedback/triage-requests` on the Hub
2. Hub writes a small item to DynamoDB: `{ requestId, requestedBy, requestedAt, sessionIds: [...pending], status: 'pending' }`
3. UI shows a modal: *"Triage queued. Run `/triage-feedback` in Claude Code to process."* with a copyable command
4. Skill, when invoked, first checks for pending triage requests and processes the explicit ones first
5. Skill marks the request `status: 'processing'`, then `status: 'done'` with a count
6. UI polls the request (or the user refreshes) to see completion

This avoids any need for a persistent webhook or local listener and keeps the user in explicit control of when the skill runs.

### 4. Prompt refinement flow

**File:** `src/app/feedback/triage/RefinePanel.tsx`

Always-visible textarea below the draft prompt. Above the prompt, a "revision N of M" chip, Undo-to-original link, and View history link. Inside the dark code block, diff-highlighted lines from the previous revision are toggleable via a "Show diff from previous" button (default off, per user decision).

When user types an instruction and clicks **Rewrite**:

1. `POST /api/feedback/[id]/refine-prompt` with `{ currentPrompt, refinementInstruction, sessionContext }`
2. Backend calls Bedrock with a system prompt enforcing:
   - Preserve original intent
   - Don't add unrelated scope
   - Keep as a standalone prompt executable by a fresh Claude Code session
   - Return `{ revisedPrompt, changeSummary }`
3. Backend appends the new revision to `proposal.revisions[]` and writes `action=refined` to the history log
4. UI re-renders with the new revision as current

Revert/View history UI lets the user move among any past revision. Only the "current" revision at approval time goes into the improvement queue.

### 5. Hub API routes (new or modified)

**New:**
- `POST /api/feedback/[id]/approve-proposal` — validates proposal, writes to `sevaro-improvement-queue` with `source: 'feedback:<sessionId>'` and `needsHumanReview: true` (so `/improvement-queue` skill still pauses on execution), PATCHes session `reviewStatus='resolved'` and clears the proposal draft (history table retains the snapshot)
- `DELETE /api/feedback/[id]/proposal` — accepts `{ reason, comment? }`, writes `action=rejected` to history log, PATCHes session `reviewStatus='rejected'`
- `POST /api/feedback/[id]/refine-prompt` — Bedrock rewrite call, appends revision, writes `action=refined`
- `POST /api/feedback/triage-requests` — enqueues an explicit triage request
- `GET /api/feedback/triage-requests` — lists pending requests (for skill polling)
- `PATCH /api/feedback/triage-requests/[id]` — skill marks processing/done
- `GET /api/feedback/themes` — returns distinct theme list + counts (backs the theme menu)
- `GET /api/feedback/triage-history` — decision log query endpoint (for the analyze theme view)

**Modified:**
- `PATCH /api/feedback/[id]` — already exists; just needs to accept `triageProposal` in payload schema

### 6. Hub UI: `/feedback/analyze` redesign

**File:** `src/app/feedback/analyze/page.tsx` (rewritten)

Mockup: approved theme view with summary stats, sort pills (Most votes default), theme cards with status breakdown bars, sparklines, and re-surfacing outline for denied-but-new-votes themes. Summary stats row includes `Awaiting triage · N →` that links to `/feedback/triage`.

No client-side Bedrock calls. Pure query + render.

### 7. Lambda changes (`sevaro-feedback-api`)

New endpoints the Lambda needs to expose for the Hub API routes to proxy:

- `GET /sessions?reviewStatus=open` — exists, may need extension
- `POST /triage-history` — write a history row
- `GET /triage-history?days=30&groupBy=theme` — read for analyze
- `GET /themes` — distinct themeIds
- `POST /triage-requests`, `GET /triage-requests`, `PATCH /triage-requests/{id}`

These can go into the same Lambda or a new handler module. Schema changes in DynamoDB: new `triageProposal` optional attribute on session items, new `sevaro-feedback-triage-history` table, new `sevaro-feedback-triage-requests` table (small, TTL-cleaned).

## Data flow

```
┌─────────────────────────────┐
│ User submits feedback via   │
│ Evidence Engine / Hub / etc │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ sevaro-feedback-api Lambda  │
│ DynamoDB: sessions          │
│ S3: audio recordings        │
└─────────────┬───────────────┘
              │
              ▼
   [ reviewStatus: open ]
              │
              │  user clicks Run Triage
              │  OR skill invoked manually
              ▼
┌─────────────────────────────┐
│ /triage-feedback skill      │
│ (runs locally in Claude     │
│ Code, has repo access)      │
└─────────────┬───────────────┘
              │
              │  per session:
              │  - Bedrock classify + theme + draft prompt
              │  - grep local repo for suspected files
              │  - PATCH session.triageProposal
              │  - POST triage-history (proposed)
              ▼
┌─────────────────────────────┐
│ /feedback/triage UI         │
│ Human reviews each proposal │
└─────────────┬───────────────┘
              │
        ┌─────┴─────┐
        │           │
        ▼           ▼
    [Refine]    [Approve]          [Reject]
    Bedrock     POST improve-q     POST history
    rewrite     mark resolved      (action=rejected
    append      append history      reason, comment)
    revision    (action=approved)
        │           │                  │
        │           ▼                  │
        │   ┌──────────────────┐       │
        │   │ improvement-queue│       │
        │   │ (existing table) │       │
        │   └────────┬─────────┘       │
        │            │                  │
        │            ▼                  │
        │   ┌──────────────────┐       │
        │   │ /improvement-    │       │
        │   │  queue skill     │       │
        │   │ executes prompts │       │
        │   └──────────────────┘       │
        │                               │
        └───────────────────────────────┘
                     │
                     ▼
           triage-history table
                     │
                     ▼
        /feedback/analyze theme view
        (groups by themeId, counts votes,
         flags re-surfacing themes)
```

## Error handling & trust gates

- **Bedrock structured output validation.** Every Bedrock call uses a JSON schema; responses that fail schema validation are logged with the raw output and skipped (no silent fallback into malformed data).
- **Confidence threshold display.** Proposals with `confidence < 0.6` are visually flagged in the UI (red-tinted card border). Users can still approve, but they know.
- **No auto-resolve.** A session is never marked `resolved` without a human click.
- **`needsHumanReview: true`** is set on every improvement queue item produced by this flow, so when the `/improvement-queue` skill picks it up it still pauses for user confirmation before executing.
- **IAM verification.** Pre-deploy check: the `SevaroHub-AmplifySSR` IAM role must have `bedrock:InvokeModel` on the `us.anthropic.claude-sonnet-4-6` inference profile ARN. Document the ARN format in the deploy notes (cross-region inference profile ARNs are not the same as foundation model ARNs).
- **Error surfacing.** The `/feedback/analyze` and `/api/feedback/[id]/refine-prompt` routes return Bedrock error details in the response body (not just "failed"), behind an admin gate so the info isn't exposed publicly.
- **No PHI in Bedrock.** Session content may contain clinical context. The triage skill strips any `encounterId` / `patientLabel` fields from session metadata before calling Bedrock (per existing `feedback_no_phi_in_telemetry` memory).
- **Refinement system prompt** is locked down: tells Claude not to add unrelated scope, not to introduce new files, not to suggest test changes unless the original prompt mentioned tests.

## UI design

### `/feedback/triage` — list + detail (Variant B approved)

- **Toolbar:** page title, pending count chip, Pending/Approved/Rejected segmented control, Run Triage button
- **Left list pane (340px):** search input, compact rows with colored left border (green=real_bug, yellow=needs_info, gray=duplicate/rejected), session short-id + app, timestamp, excerpt, classification + theme chips
- **Right detail pane:** session meta header, three tabs (Proposal / Original session / History), feedback excerpt block, agent classification card with 5-dot confidence meter + rationale, clickable theme chip (popover shows all sessions with same theme), suggested files list with line numbers and context snippets, draft prompt dark code block with diff-toggle, refine-prompt textarea + Rewrite button, revision history expandable panel, optional reviewer notes field
- **Sticky action bar** at bottom of detail pane: destination queue label ("On approve → creates sevaro-improvement-queue item for sevaro-evidence-engine") + Reject… / Edit prompt / Approve → buttons
- **Reject flow:** click Reject → modal with radio reasons (not_a_real_issue / already_fixed / low_priority / duplicate / out_of_scope / need_more_info) + optional comment textarea + Confirm Reject / Cancel
- **Refine prompt:** always-visible textarea below prompt; no toggle or modal. Last refinement instruction shown as italic memory. Diff highlighting is toggleable via "Show diff from previous" button, default off.
- **Keyboard:** ↑↓ list nav, A=approve, R=reject (opens modal), E=edit (focuses refine textarea), Space=toggle diff, Esc=close popovers

### `/feedback/analyze` — theme view

- **Header:** title + time range selector (default 30d), app filter, Refresh button
- **Summary stats row:** total sessions / total themes / trending up / new-votes-since-denial / awaiting triage (with direct link `N →` to `/feedback/triage`)
- **Sort pills:** Most votes (default) / Trending / Most recent / Re-surfacing
- **Theme cards:** one full-width card per theme. Card contents: theme slug chip, trending chip if applicable, human description, affected apps, vote count (large number on right), status breakdown bar (green/yellow/gray), weekly trend sparkline, Expand/Collapse link
- **Re-surfacing themes** (denied + new votes since): card gets red outline (`border: 1px solid #fecaca`) + `⚠ N new votes since denial` chip in `#fecaca`/`#7f1d1d`. No banner, no modal — just the honest visual signal
- **Expanded theme shows** session list with per-session status badges, short excerpts, timestamps, and "Open in triage →" link per row
- **Run triage on these N now** button — explicit trigger, enqueues a triage-request as above

## Testing

- **Unit tests** (hub): route handlers for approve / reject / refine / triage-requests with mocked Lambda responses
- **Unit tests** (skill): classify → grep → patch flow with mocked Bedrock and mocked hub API
- **Integration tests** (Playwright or similar, against a staging deploy): submit a test feedback session via the Lambda, run the triage skill, verify proposal appears in UI, approve it, verify it appears in improvement queue
- **Theme grouping test:** seed the history table with known rows (approved / denied / mixed / re-surfacing patterns), hit `/api/feedback/analyze`, assert the theme rollup numbers and re-surfacing flag are computed correctly
- **Schema validation test:** feed Bedrock responses with malformed JSON, markdown-wrapped JSON, missing fields — assert schema validation rejects them gracefully without crashing the skill
- **Auth test:** non-admin user attempting any new route returns 403; admin user token expiring mid-session returns 401 with `handleAuthExpired` recovery (follows the pattern established in the Apr 14 silent-401 fix)

## Build order (rough outline — full plan in writing-plans skill)

1. **DynamoDB + Lambda schema changes** — add `triageProposal` field to sessions, create `sevaro-feedback-triage-history` and `sevaro-feedback-triage-requests` tables, extend `sevaro-feedback-api` with new endpoints
2. **Fix + replace `/feedback/analyze` backend** — new query-based route, kill the old Bedrock clustering
3. **Triage skill** — standalone, runs against existing Lambda endpoints, produces proposals
4. **Hub `/feedback/triage` UI** — list + detail + proposal, refine panel, approve/reject/refine routes
5. **Hub `/feedback/analyze` UI** — redesigned theme view
6. **Run Triage button** + triage-requests queue glue
7. **IAM + deploy verification** — confirm `bedrock:InvokeModel` permission, test a real Bedrock call from Amplify SSR, test a real call from the skill
8. **End-to-end smoke test** with a test user in the Cognito pool

## Open questions (for the implementation plan, not this spec)

- **Test user.** To test the Hub UI in a separate browser without touching the real admin email, we'll need a second Cognito user in `us-east-2_9y6XyJnXC` added to `ADMIN_EMAILS`. Plan is to create a disposable one during implementation and remove it after smoke tests.
- **Vote threshold for re-surfacing flag.** v1 visual flag fires when `newVotesSinceDenial >= 1`. Do we want that configurable, or hard-code 1? Punting to implementation.
- **Theme slug canonicalization.** The skill grabs existing themes as a menu to prevent drift, but drift is still possible when Claude proposes a new theme that's semantically close to an existing one. A cleanup pass is out of scope; a periodic "list similar themes" debug query might be useful later.
- **Refinement context limits.** If a proposal has many revisions, the prompt-refinement call's context grows. Bounded at "last 5 revisions" initially; revisit if needed.

## Approved decisions (recap from brainstorming)

- **Approach A** — proposal-on-session (not a separate triage table)
- **Validation depth** — LLM reads session artifacts + maps to suspected code (not live repro)
- **Trigger** — local skill invocation (not Hub-only Bedrock, not GitHub Actions)
- **Approval routing** — existing `sevaro-improvement-queue` (not new table, not auto-spawn)
- **`/feedback/analyze`** — fix + keep separate as theme view (not deprecate, not merge into triage)
- **v1 scope** — all three layers (decision log + theme classification + theme grouping), no red alert banner, no auto-reopen
- **UI pattern** — list + detail (Variant B)
- **Reject flow** — modal with structured reason radio + optional comment
- **Refinement flow** — always-visible textarea, AI rewrites the prompt from natural-language instructions, no hand editing
- **Diff highlighting** — toggle, default off
- **Cost heads-up** — user acknowledges ~cents per refinement click, not a concern at current scale
- **Run Triage button** — explicit queue-request mechanism (not passive link)
