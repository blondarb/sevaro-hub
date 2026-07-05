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

**Status**: Active — verified July 5, 2026

### Recent
- **Daily sync: roadmap milestones and prompts (Jul 5, 2026)** — sevaro-evidence-engine: Added 2 new Recent items (rounding safety threads 1-2 PRs #983-984; threads 4a/4b/4d + grounding + telemetry fixes PRs #985-988); removed 2 oldest items; verified date → Jul 5. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion, sevaro-ops: verified dates → Jul 5. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jul 4 rounding safety thread context (PRs #983-988); sdne + opsamplehtml milestones refreshed to Jul 5.
- **Daily sync: roadmap milestones and prompts (Jun 29, 2026)** — OPSAmplehtml: added triage crash fix + triage latency reduction (Jun 26 items missing from prior syncs) to Recent, removed 2 oldest items; verified → Jun 29. sevaro-evidence-engine: no new code since Jun 27; verified → Jun 29. SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion, sevaro-ops: verified dates → Jun 29. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys + voice-transcriber-steel-man + market-day-vr-sonali + opsamplehtml milestones + 6 clinical plans repos quickPrompts updated with Jun 29 context.
- **Daily sync: roadmap milestones and prompts (Jun 28, 2026)** — No new code commits since Jun 27. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, sevaro-ops, spine-surgery-v2, xr-test-companion, sevaro-evidence-engine: verified dates → Jun 28. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jun 28 stable-state context.
- **Daily sync: roadmap milestones and prompts (Jun 27, 2026)** — sevaro-evidence-engine: Two prod fixes: physicianEmail stamp on chart-prep split children (PR #948) — prevents cross-IdP 403 errors when APP physicians generate notes for multiple patients in a single chart-prep session; buildGeneratePayload re-export removed from route.ts (PR #947) — was causing Amplify prod build failure. BoW Recent updated with 1 new item (PRs #947-948); verified date → Jun 27. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, sevaro-ops, spine-surgery-v2, xr-test-companion: verified dates → Jun 27. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jun 27 context (PRs #947-948).
- **Daily sync: roadmap milestones and prompts (Jun 26, 2026)** — sevaro-evidence-engine: Prior-Note Reference Mode + HPI paragraph readability shipped dark (PR #940) — PRIOR_NOTE_REFERENCE_MODE_ENABLED strips prior-note plan/exam before combine; HPI_PARAGRAPH_STYLE_ENABLED injects paragraph directive across all HPI prompts; payload-builder.ts extracted (52+ tests green); per-section restyle preview + revert shipped dark (PR #944) — STYLE_SECTION_PREVIEW_ENABLED; bug fixes: categories-only chart prep (PR #943), manual note arrival for Riya (PR #941), Windows 403 ownership race (PR #938). BoW Recent updated with 3 new items, 3 oldest rotated out; verified date → Jun 26. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, sevaro-ops, spine-surgery-v2, xr-test-companion: verified dates → Jun 26. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jun 26 context (PRs #938, #940-941, #943-944).
- **Daily sync: roadmap milestones and prompts (Jun 25, 2026)** — sevaro-evidence-engine: Ask box sends live note text to /ask API (PRs #936-937, Jun 25) — richer routing context; eval 5-judge panel + variance bands (PR #927, Jun 25) — GPT-5 + Gemini added; flag-gated Suggest Scales in chart prep (PRs #928-929, Jun 25) — NEXT_PUBLIC_SUGGESTED_SCALES_ENABLED default OFF; router Codex hardening + feedback IDOR/PHI fixes (PRs #926, #930-931, Jun 25). BoW Recent updated with 4 new items, 3 oldest rotated out; verified date → Jun 25. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, sevaro-ops, spine-surgery-v2, xr-test-companion: verified dates → Jun 25. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jun 25 context (PRs #926-937).
- **Daily sync: roadmap milestones and prompts (Jun 24, 2026)** — sevaro-evidence-engine: Riya intent router shipped (PRs #917-925, Jun 23) — Ask box wired to encounter Tools panel, routes by intent type (clinical/drug/general), flag-gated dark by default; prod fixes: ENCOUNTERS_TABLE pointed to prod, full note routing context, drug-interaction → DRUG. KB HYBRID-SEMANTIC fallback + sparse note guard (PRs #920-921). BoW Recent updated with 2 new items, 3 oldest rotated out; verified date → Jun 24. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, sevaro-ops, spine-surgery-v2, xr-test-companion: verified dates → Jun 24. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with intent router + KB fallback context (PRs #917-925, #920-921, Jun 23).

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
