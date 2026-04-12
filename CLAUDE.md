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
- **Daily sync (Apr 12)** — Evidence Engine: full-text coverage expansion (PRs #255-260 — KB monitoring, metadata sidecar auto-generation, billing audit soft-match + disagreement scoring, Unpaywall+PMC OA bulk, PDF extraction, PMC-first upgrader + PDF viewer) added to BoW. Feedback: EEG CORS allowlist (PR #9) added to BoW. EEG Reporter: feedback widget integration + product tour (PR #21) added to BoW. Roadmap: note-generation-polish quickPrompt updated with full-text expansion context.
- **Daily sync (Apr 11)** — Evidence Engine: document attachment for chat (PR #254, Apr 10) added to BoW; speech-pipeline-validation marked done (SDNE E2E headset validation complete, Apr 9). Feedback: chat-only session fix corrected to PR #8. Roadmap: note-generation-polish quickPrompt updated with document attachment.
- **Daily sync (Apr 10)** — SDNE: April 9 beta demo sprint complete (PRs #11-12) — score-speech Lambda wired, WAV capture fixed, session/audio upload ordering fixed, 13 total fixes tested on headset; sdne-beta-demo-apr9 milestone added to roadmap, speech-pipeline-validation quickPrompt refreshed. Evidence Engine: pnpm lockfile sync (PR #253, Apr 8) added to BoW.
- **Daily sync: OPSAmple + xr-test-companion BoW + roadmap refresh (Apr 8)** — OPSAmple: Neuro Intake/Consult Pipeline hardening (Apr 5-7) captured. xr-test-companion: auto-start video recording (PR #12, Apr 7) added. Roadmap: em-coding-cloudwatch-dashboard refreshed (Shadow Coder + telehealth codes done, 453 tests, last pending E/M milestone).
- **Daily sync (Apr 7)** — em-coding-deploy milestone marked done (live at coding.neuroplans.app). SDNE Apr 6 headset session fixes captured in Body of Work. sevaro-em-coding-ui Planned updated (Phase 1C complete). Roadmap.json updated.
- **Daily sync: roadmap prompts refreshed for pending milestones (Apr 7)** — Updated note-generation-polish quickPrompt/description to include On-Call Facility Guides (PR #250, Apr 6) and multi-record fixes (PR #248). Refreshed live-voice-streaming quickPrompt with Evidence Engine progressive streaming pattern (Apr 5) as reference.
- **Daily sync: roadmap milestones and prompts (Apr 6)** — Marked chart-prep-transition done (Unified Encounter Workspace PR #226-231). Updated note-generation-polish quickPrompt with On Call Guide extension tab and stat level KB additions.

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
