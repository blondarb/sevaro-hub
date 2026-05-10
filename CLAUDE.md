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

**Status**: Active — verified May 10, 2026

### Recent
- **Codex round 2: chat DTO redaction, approve order, resolve lookup (PR #28, Apr 22)** — Cross-model round 2 review: chat DTO fields scrubbed before Hub renders; approve action ordering corrected; `resolvedBy` lookup hardened to only query when a resolution event is present.
- **Codex Priority 2: PHI redaction + audit integrity (PR #27, Apr 21)** — PHI redaction applied to additional Hub render paths; audit log integrity tightened to prevent gaps in triage history trail.
- **Remove secrets from next.config.ts env block (PR #26, Apr 21)** — Secrets were leaking into the client bundle via `next.config.ts` `env:` block; moved to server-only access patterns; eliminates client-side secret exposure.
- **Fix resolvedBy only set when resolving (PR #25, Apr 21)** — `resolvedBy`/`resolvedAt` were being stamped on approval (not resolution); now only written when `reviewStatus` transitions to `resolved`.
- **Feedback pipeline Phase 1+2: approval state fix + PHI render cleanup (Apr 21)** — approve-proposal now PATCHes `reviewStatus: 'in_progress'` only (not `resolved`); `SessionDetailClient` stopped rendering PHI-bearing annotation fields; 64 tests passing.
- **Feedback "mark addressed" prompt template includes `x-api-key` (Apr 15)** — `generateClaudeCodePrompt()` now emits a two-step shell command: Secrets Manager fetch + curl with `-H "x-api-key"` chained via `&&`.
- **Feedback triage system live (Apr 14)** — Human-in-the-loop triage loop end-to-end: DynamoDB triage tables, 6 Lambda routes, Hub API proxy routes, `/feedback/triage` UI with ProposalDetail + RejectModal + keyboard nav, `/feedback/analyze` redesigned as theme rollup. 64 vitest tests.

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
