# Sevaro Hub

> **MEMORY PROTOCOL:** Read HANDOFF.md first and update it last every session — it is the shared source of truth with ChatGPT/Codex.

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

**Status**: Active — verified July 12, 2026

### Recent
- **Daily sync: roadmap milestones and prompts (Jul 12, 2026)** — OPSAmplehtml: Added 4 new Recent items (iOS audio AudioWorklet definitive fix; relay duplicate-transcript root cause fixed + deploy.sh; Clara protocol hardening v2; Clara shareable invite links + physician-to-physician persona); dropped 4 oldest items; verified → Jul 12. sevaro-evidence-engine, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion, sevaro-ops: verified dates → Jul 12. Roadmap: opsamplehtml-live-voice-streaming quickPrompt updated with Jul 12 iOS audio fix + relay fix + Clara protocol hardening + shareable links; evidence-optimize-synthesis-speed, evidence-sso-passkeys, evidence-clinical-threshold-tuning, sdne-watch-imu-integration verified → Jul 12.
- **Daily sync: roadmap milestones and prompts (Jul 11, 2026)** — OPSAmplehtml: Added Nova historian quality fixes (PR #154) — VoiceProvider.nudgeClosing() for closing statement, CRITICAL RULE 7 over-acknowledging fix, CRITICAL RULE 11 re-ask prevention; dropped oldest item; verified → Jul 11. sevaro-evidence-engine: Added Generate Lambda latency instrumentation + Haiku model-tail bug fix + noteReadyAt (PR #1042); dropped oldest item; verified → Jul 11. neuro-plans-v2, SDNE: verified → Jul 11. VoiceTranscriber, cardio-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion, sevaro-ops: verified → Jul 11. Roadmap: all 5 pending milestone quickPrompts updated (evidence-sso-passkeys Jul 11 + PR #1042 latency; evidence-clinical-threshold-tuning stable Jul 11; opsamplehtml-live-voice-streaming + PR #154 Nova historian quality fixes; sdne-watch-imu-integration stable Jul 11; evidence-optimize-synthesis-speed already updated Jul 11 earlier this session).
- **Daily sync: roadmap milestones and prompts (Jul 10, 2026)** — OPSAmplehtml: Added 4 new Recent items (Nova Sonic revive + relay PRs #144-149; close/barge-in fixes PRs #150-151; post-interview report tabs PR #152; silence-at-start fix PR #153); dropped 4 oldest; verified → Jul 10. SDNE: Added 2 new Recent items (scoring breakdown + data dictionary PRs #70-72; oculomotor INVALID reason codes PR #73); dropped 2 oldest; verified → Jul 10. sevaro-evidence-engine: Added 3 new Recent items (finalize style profile + import-as-reference PRs #1041/#1043; recovery hardening PRs #1034-1040; specialty detection revert PR #1033); dropped 6 oldest; verified → Jul 10. neuro-plans-v2: Added scale catalog ledger rescope (PR #30); verified → Jul 10. Roadmap: all 5 pending milestone quickPrompts updated (evidence-optimize-synthesis-speed, evidence-sso-passkeys, evidence-clinical-threshold-tuning, opsamplehtml-live-voice-streaming, sdne-watch-imu-integration) with Jul 7-10 context.
- **Daily sync: roadmap milestones and prompts (Jul 8, 2026)** — sevaro-evidence-engine: Added 2 production incident fixes (PRs #1021-1022, Jul 8) — batch chart-prep null-categories crash guard + multi-patient-parent gate across Modes 1,2,6,7; dropped oldest item; verified → Jul 8. All other repos: verified dates → Jul 8. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jul 8 batch chart-prep incident context (PRs #1021-1022); opsamplehtml + sdne + clinical plans milestones refreshed to Jul 8.
- **Daily sync: roadmap milestones and prompts (Jul 7, 2026)** — OPSAmplehtml: Added historian 2nd-session stability fixes (PRs #137, #139); dropped 2 oldest items; verified → Jul 7. sevaro-evidence-engine: Added 2 new Recent items (on-call LVO pipeline + SharePoint delta-watch PRs #1015-1019; visit timestamps + ops-search + quality-review fixes PRs #945, #1014, #1020); dropped 2 oldest items; verified → Jul 7. SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion, sevaro-ops: verified dates → Jul 7. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jul 7 on-call/LVO/SharePoint/plans.json/visit-timestamps context; opsamplehtml + sdne + clinical plans milestones refreshed to Jul 7.
- **Daily sync: roadmap milestones and prompts (Jul 6, 2026)** — sevaro-evidence-engine: Added 2 new Recent items (recording-stuck-recovery sweep PRs #1008-1011; review hardening/MEDICATIONS/PHI fixes PRs #991, #994-1013); dropped 2 oldest items; verified date → Jul 6. neuro-plans-v2: Added ESLint 9 flat config fix (PR #29); verified → Jul 6. sevaro-ops: Added base64 decode fix PRs #6/#9; dropped oldest item; verified → Jul 6. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion: verified dates → Jul 6. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with recording-stuck-recovery + MEDICATIONS/review/PHI hardening context (PRs #991-1013); sdne + opsamplehtml + clinical plans milestones refreshed to Jul 6.
- **Daily sync: roadmap milestones and prompts (Jul 5, 2026)** — sevaro-evidence-engine: Added 2 new Recent items (rounding safety threads 1-2 PRs #983-984; threads 4a/4b/4d + grounding + telemetry fixes PRs #985-988); removed 2 oldest items; verified date → Jul 5. OPSAmplehtml, SDNE, VoiceTranscriber, cardio-plans-v2, neuro-plans-v2, neurocrit-care-v2, personal-tools, pmr-rehab-v2, pulm-crit-care-v2, spine-surgery-v2, xr-test-companion, sevaro-ops: verified dates → Jul 5. Roadmap: evidence-optimize-synthesis-speed + evidence-sso-passkeys quickPrompts updated with Jul 4 rounding safety thread context (PRs #983-988); sdne + opsamplehtml milestones refreshed to Jul 5.
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
