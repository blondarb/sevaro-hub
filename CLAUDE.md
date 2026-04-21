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
- **Feedback pipeline Phase 1+2: approval state fix + PHI render cleanup (Apr 21)** — Cross-model codex review surfaced two problems on the Hub side: (1) approving a triage proposal was PATCHing the session straight to `reviewStatus: 'resolved'` with `resolvedBy`/`resolvedAt` timestamps — but approval only means "proposal queued to the fix engineer", and flipping to resolved prematurely suppressed sessions from the open-feedback list before the fix had shipped; (2) `SessionDetailClient` was rendering PHI-bearing annotation fields (raw URLs, DOM text) that older Lambda versions stored. Phase 1 (Codex): normalized legacy session data in `feedback-api.ts` (tolerates `in_review`); stopped rendering PHI fields in `SessionDetailClient.tsx`. Phase 2 (this pass, TDD): `approve-proposal/route.ts` now PATCHes `reviewStatus: 'in_progress'` + clears `triageProposal` only; resolution stays a separate manual step when the fix actually lands. Audit trail preserved via `postTriageHistory` (action: `approved`, reviewerEmail, timestamp). Full test suite: 9 files, 64 tests passing; tsc clean. Partner PR in `sevaro-feedback` hardens free-text PHI end-to-end.
- **Feedback "mark addressed" prompt template now includes `x-api-key` (Apr 15)** — `generateClaudeCodePrompt()` in `src/lib/feedback-api.ts` was generating a curl command for Claude Code sessions to mark feedback as addressed, but the emitted curl was missing the `x-api-key` header — the API Gateway rejected it with `{"error":"Invalid API key"}`. Counterpart to PR #21 (inline `FEEDBACK_API_KEY` at build time) and the Apr 13 fix that added the header to the Hub runtime API calls (`listSessions`, `getSession`) — both of those passes missed the prompt template code path. Template now emits a two-step shell command: (1) `FEEDBACK_API_KEY=$(AWS_PROFILE=sevaro-sandbox aws secretsmanager get-secret-value --region us-east-2 --secret-id sevaro/feedback-api-key --query 'SecretString' --output text)` to fetch the key from Secrets Manager, (2) chained via `&&` so the curl only runs if the fetch succeeds, with `-H "x-api-key: $FEEDBACK_API_KEY"` added to the existing curl. Copy updated from "this curl command" to "these commands" with a one-sentence note explaining why the key fetch is needed. Verified end-to-end by running the exact command pattern against the live API in the session that caught the bug (session `f60ac8f9-c6eb-4120-92e5-bf8edaeeda68`) — API responded with `{"sessionId":"...","status":"updated"}`. Surgical: 6-line change to the template generator, no other files touched, no tests on the function to update.
- **Inline FEEDBACK_API_KEY at build time (PR #21, Apr 15)** — Hardened feedback API key handling by embedding it as a build-time environment variable rather than relying on runtime injection; ensures consistent key availability across SSR and client rendering in the Amplify-hosted app.
- **Feedback triage system live (Apr 14)** — Cross-repo human-in-the-loop triage loop shipped end-to-end. Phase 1 (`sevaro-feedback` Lambda): 2 new DynamoDB tables (`sevaro-feedback-triage-history`, `sevaro-feedback-triage-requests` with 72h TTL), 6 new routes on API Gateway `8uagz9y5bh` — `POST/GET /triage-history`, `POST/GET /triage-requests`, `PATCH /triage-requests/{id}`, `GET /themes`. `session.triageProposal` field added. 10 commits. Phase 2 (Hub API routes, PR #18): 6 Next.js API routes that proxy to the Lambda, `/api/feedback/analyze` rewritten as a query-based theme rollup (no more Bedrock call on every request), approve/reject/refine-prompt routes, Bedrock `refinePrompt` wrapper via `ConverseCommand` on `us.anthropic.claude-sonnet-4-6`, 60 vitest tests. Phase 3 (`~/.claude/skills/triage-feedback/`): Claude Code skill that fetches unreviewed sessions, classifies with Bedrock, greps local repos for suspected files, writes proposals back. Phase 4/5 (UI, PR #19): `/feedback/triage` page with two-pane list+detail, `ProposalDetail` with diff toggle + refine panel + confidence flag, `RejectModal` with 6 structured reasons, keyboard nav (↑/↓/a/r), Run Triage button; `/feedback/analyze` redesigned as theme rollup view with sort pills + weekly trend sparklines. 64 vitest tests total.
- **Fix silent 401 on feedback Save Status (Apr 14)** — `/feedback/[id]` had no server-side auth gate, so a stale tab with an expired `id_token` could fully render via the Lambda's `x-api-key`-only GET, and only fail when the user clicked Save Status. Added `verifyToken(cookies().id_token)` gate at the page level and replaced the swallowing helper with explicit `handleAuthExpired` recovery in `SessionDetailClient`.
- **x-api-key auth header fix for Lambda session endpoints (Apr 13)** — Added missing x-api-key authentication header to listSessions and getSession API Gateway calls; Hub session list now loads correctly.
- **SDNE April 9 beta demo sprint captured + roadmap milestone added (Apr 10)** — SDNE PRs #11-12 synced to BoW: score-speech Lambda wired, WAV capture fixed, session/audio upload ordering fixed, 13 total fixes tested on headset. sdne-beta-demo-apr9 milestone added to roadmap.json; speech-pipeline-validation marked done.
- **Cross-repo BoW + roadmap refresh (Apr 7-12)** — Evidence Engine: KB/full-text expansion (PRs #255-261), billing audit, document attachment all synced. EEG Reporter: feedback widget + product tour (PR #21) synced. OPSAmple: neuro intake pipeline hardening captured. xr-companion: auto-record (PR #12) added. Roadmap: em-coding-deploy milestone marked done; note-generation-polish quickPrompt kept current across all syncs.

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
