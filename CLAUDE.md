# Sevaro Hub

Splash page and admin dashboard for Sevaro apps. Includes feedback management with Cognito auth, pattern analysis via Bedrock, and email notifications via SES. Hosted on AWS Amplify at `hub.neuroplans.app`.

## Design System (MANDATORY)
- **Reference:** `~/dev/repos/sevaro-design-system/DESIGN_SYSTEM.md` — all colors, typography, components
- **Figma:** [Sevaro Design System](https://www.figma.com/design/2SvpMV4WE5CFjxvsxTRg1w/Sevaro-Design-System) (file key: `2SvpMV4WE5CFjxvsxTRg1w`)
- All UI must match the design system 1:1. Read the reference doc before building any UI component.

## Tech Stack

- **Type**: Next.js 15 (App Router, SSR)
- **Hosting**: AWS Amplify (`d3n3e9vr1knkam`)
- **Domain**: `hub.neuroplans.app`
- **Deploy**: Auto-deploys on push to `main`
- **Auth**: Amazon Cognito (`us-east-2_9y6XyJnXC`, client `2ejoumofnhhd3133gv9e9i6r1h`)
- **IAM Role**: `SevaroHub-AmplifySSR` (SES, Bedrock, SSM permissions)
- **Email**: SES from `feedback@neuroplans.app` (DKIM verified)
- **AI**: Bedrock Sonnet for feedback pattern analysis
- **Feedback API**: Lambda `sevaro-feedback-api` via API Gateway `8uagz9y5bh`
- **What's New API**: Lambda `sevaro-whats-new-api` via API Gateway `5168ofhh8k`
  - DynamoDB table: `sevaro-whats-new` (PK: `appId`, SK: `timestamp`)
  - JWT verified via `aws-jwt-verify` (Cognito signature + claims)
  - Public: `GET /whats-new?appId=...&since=...`
  - Admin: `GET /whats-new/all`, `POST /whats-new`, `DELETE /whats-new`
- **Improvement Queue API**: Lambda `sevaro-improvement-queue-api` via API Gateway `ael0orzmsk`
  - DynamoDB table: `sevaro-improvement-queue` (PK: `repoName`, SK: `promptId`)
  - JWT verified via `aws-jwt-verify` (Cognito signature + claims)
  - Admin: `GET /improvements`, `POST /improvements`, `PATCH /improvements`, `DELETE /improvements`
  - Lambda source: `lambda/sevaro-improvement-queue-api/`

## Admin Access

- Controlled by `ADMIN_EMAILS` env var (default: `steve@sevaro.com`)
- JWT verification via Cognito JWKS
- Protected routes: `/feedback`, `/feedback/analyze`, `/feedback/[id]`, `/admin/whats-new`, `/admin/improvements`

## Body of Work

**Status**: Active

### Recent
- **Feedback triage system live (Apr 14)** — Cross-repo human-in-the-loop triage loop shipped end-to-end. Phase 1 (`sevaro-feedback` Lambda): 2 new DynamoDB tables (`sevaro-feedback-triage-history`, `sevaro-feedback-triage-requests` with 72h TTL), 6 new routes on API Gateway `8uagz9y5bh` — `POST/GET /triage-history`, `POST/GET /triage-requests`, `PATCH /triage-requests/{id}`, `GET /themes`. `session.triageProposal` field added. 10 commits. Phase 2 (Hub API routes, PR #18): 6 Next.js API routes that proxy to the Lambda, `/api/feedback/analyze` rewritten as a query-based theme rollup (no more Bedrock call on every request), approve/reject/refine-prompt routes, Bedrock `refinePrompt` wrapper via `ConverseCommand` on `us.anthropic.claude-sonnet-4-6`, 60 vitest tests. Phase 3 (`~/.claude/skills/triage-feedback/`): Claude Code skill that fetches unreviewed sessions, classifies with Bedrock, greps local repos for suspected files, writes proposals back. Phase 4/5 (UI, PR #19): `/feedback/triage` page with two-pane list+detail, `ProposalDetail` with diff toggle + refine panel + confidence flag, `RejectModal` with 6 structured reasons, keyboard nav (↑/↓/a/r), Run Triage button; `/feedback/analyze` redesigned as theme rollup view with sort pills + weekly trend sparklines. 64 vitest tests total (4 React component tests). Task 22 verified `SevaroHub-AmplifySSR` already has `bedrock:Converse` perms. Playwright E2E (Task 23) deferred. Spec: `docs/superpowers/specs/2026-04-14-feedback-triage-design.md`. Plan: `docs/superpowers/plans/2026-04-14-feedback-triage.md`.
- **Fix silent 401 on feedback Save Status (Apr 14)** — `/feedback/[id]` had no server-side auth gate, so a stale tab with an expired `id_token` could fully render via the Lambda's `x-api-key`-only GET, and only fail when the user clicked Save Status. PATCH then returned 401 with no user-visible error because `getAuthHeaders()` silently dropped the `Authorization` header when refresh failed. Added `verifyToken(cookies().id_token)` gate at the page level and replaced the swallowing helper with explicit `handleAuthExpired` recovery in `SessionDetailClient`. See `docs/HANDOFF_2026-04-14.md`.
- **Daily sync (Apr 14)** — Evidence Engine: Chrome extension stability sprint (PRs #263–#269) captured in BoW — async Lambda polling for evidence search, manifest microphone permission fix, recording connection freeze fix, E2E tests for update detection + recording + telemetry, mic permission banner fix (v1.3.2), skip display media for inpatient encounters. Roadmap: note-generation-polish quickPrompt/description refreshed with extension stability sprint context.
- **x-api-key auth header fix for Lambda session endpoints (Apr 13)** — Added missing x-api-key authentication header to listSessions and getSession API Gateway calls; Hub session list now loads correctly.
- **Daily sync (Apr 12)** — Evidence Engine: full-text coverage expansion (PRs #255-261 — KB monitoring, metadata sidecar auto-generation, billing audit soft-match + disagreement scoring, Unpaywall+PMC OA bulk, PDF extraction, PMC-first upgrader + PDF viewer) added to BoW. Feedback: EEG CORS allowlist (PR #9) added to BoW. EEG Reporter: feedback widget integration + product tour (PR #21) added to BoW. Roadmap: note-generation-polish quickPrompt updated with full-text expansion context.
- **Daily sync (Apr 11)** — Evidence Engine: document attachment for chat (PR #254, Apr 10) added to BoW; speech-pipeline-validation marked done (SDNE E2E headset validation complete, Apr 9). Feedback: chat-only session fix corrected to PR #8. Roadmap: note-generation-polish quickPrompt updated with document attachment.
- **Daily sync (Apr 10)** — SDNE: April 9 beta demo sprint complete (PRs #11-12) — score-speech Lambda wired, WAV capture fixed, session/audio upload ordering fixed, 13 total fixes tested on headset; sdne-beta-demo-apr9 milestone added to roadmap, speech-pipeline-validation quickPrompt refreshed. Evidence Engine: pnpm lockfile sync (PR #253, Apr 8) added to BoW.
- **Daily sync: OPSAmple + xr-test-companion BoW + roadmap refresh (Apr 8)** — OPSAmple: Neuro Intake/Consult Pipeline hardening (Apr 5-7) captured. xr-test-companion: auto-start video recording (PR #12, Apr 7) added. Roadmap: em-coding-cloudwatch-dashboard refreshed (Shadow Coder + telehealth codes done, 453 tests, last pending E/M milestone).
- **Daily sync (Apr 7)** — em-coding-deploy milestone marked done (live at coding.neuroplans.app). SDNE Apr 6 headset session fixes captured in Body of Work. sevaro-em-coding-ui Planned updated (Phase 1C complete). Roadmap.json updated.

### In Progress
- None

### Planned
- Admin management page (view/add/remove administrators)
- Request SES production access (currently sandbox — recipients must be verified)

### Known Issues
- SES in sandbox mode — can only send to verified email addresses

## Documentation Files

Update these when committing changes (per global Commit Workflow rules):

- `CLAUDE.md` — update if architecture, config, or status changed
- `docs/HANDOFF_YYYY-MM-DD.md` — create/update with session summary and next steps
- `docs/plans/` — update relevant plan files if scope or approach changed
