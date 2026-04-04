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
- **Daily sync: Body of Work updates across all repos (Apr 4)** — Feedback widget security hardening reflected in 7 CLAUDE.md files (OPSAmple, all plan-sites); spine/pulm/neurocrit/pmr plans-populated status updated; evidence engine Recent trimmed to 6 items; roadmap prompts refreshed.
- **Roadmap sync: competitive-eval-impl marked done (Apr 4)** — Evidence Engine competitive eval pipeline fully shipped (PRs #185-194); milestone updated to done with current keyFiles.
- **Developer CLI section (Apr 3)** — Added Developer CLI section to hub with full recovery instructions for common infrastructure issues.
- **Daily sync: roadmap milestones and Body of Work (Apr 1)** — admin-api and sevaro-aws-lambda BoW updated for Bedrock prompt caching PRs; roadmap pending milestone prompts refreshed for github-showcase and neuroscribe
- **Roadmap milestone sync (Mar 31)** — patient-registry (evidence-engine) and eeg-report-templates (eeg-reporter) marked done. Body of Work trimmed to 5-7 items across OPSAmple, EEG Reporter, Evidence Engine.
- **Feedback dashboard filter chips (Mar 29)** — Category (bug/suggestion/etc.) and review status (Open/In Progress/Resolved/Dismissed) chips are now interactive filters; stack with app tab; clear on tab switch; "Clear filters" empty state
- **Added live cards for Cardio, NeuroCrit, PM&R, EEG Reporter; dev cards for Pulm/Spine (Mar 29)** — Hub now shows 9 live clinical apps, 2 dev-in-progress apps with milestone links

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
