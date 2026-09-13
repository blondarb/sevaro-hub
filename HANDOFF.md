# HANDOFF — sevaro-hub

_Single source of truth for cross-AI handoffs. Claude (Cowork/Claude Code) and
ChatGPT/Codex read this FIRST and update it LAST. Plain language. No PHI (initials
only). No secrets._

## Snapshot (keep current)
- Status: Portfolio source is committed and pushed at `227f41e` on `codex/portfolio-operating-system`; the July data is a historical snapshot, not current project authority. September 13 architecture evaluation selects private Sites + native Voice with this repo as integration home; see `docs/command-center/SITES_VOICE_ARCHITECTURE.md`. No new UI, bridge or Site is implemented/deployed.
- Driver this week: Review the validated `/admin/portfolio` change, reconcile the unavailable original idea-dump email, and confirm the private `memory/people` location before assigning owners.
- Lives in: https://github.com/blondarb/sevaro-hub.git

## Open threads / next actions
- [ ] Retrieve and reconcile the original idea-dump email; current Outlook access reached MFA and was not completed.
- [ ] Confirm the canonical private `memory/people` path; do not create a duplicate or modify `Contacts.md`.
- [ ] Review provisional project scope, ownership, priority, and Rhea/Riya spelling before marking records verified.
- [ ] Obtain review before committing, pushing, deploying, or changing production improvement rows.

## Decisions log (append-only, newest first)

## Session log (append-only, newest first)

### 2026-09-13 · ChatGPT · Synthetic shared-context proof only
- Did: Added one immutable synthetic snapshot, fixed numbered references, read-only Worker/browser tools and fail-closed owner binding. Local browser/WebMCP returned the same item 2; four Node tests passed.
- Files/links touched: `command-center-proof/`; `docs/command-center/SHARED_CONTEXT_ACCEPTANCE_20260913.md`; draft PR #37.
- Decisions: No real executive/clinical data or broad UI. Private Site registration is owner-only, but unpublished. Shared source remains here; the Site build copies only the proof allowlist.
- Open questions / needs Claude: Secure Sites publishing transport, actual hosted owner/anonymous/other-user tests, and native Voice retrieval remain unaccepted. Preserve existing Outlook/Fyxer ingestion and data.js/index.html ownership.
- Next: Resolve the authenticated proof blockers and pass Site/native Voice acceptance before adding data or UI. Do not merge automatically.
### 2026-09-13 · ChatGPT · Private Sites and native Voice architecture
- Did: inspected the existing portfolio branch, live Sites access metadata and official Sites/Voice capabilities; specified a shared exception context and source/PHI boundaries.
- Files/links touched: `docs/command-center/SITES_VOICE_ARCHITECTURE.md`, this HANDOFF.
- Decisions: Asana remains authoritative; Claude retains Outlook/Fyxer ingestion; Sites is the private visual surface; native Voice is conversational; Hub owns normalization. Reuse existing code without treating July portfolio JSON as live data.
- Open questions / needs Claude: narrow approved executive export; authenticated Hub-to-Site/Voice bridge and synthetic identical-snapshot acceptance remain unimplemented. No existing artifact ownership changes.
- Next: implement/verify the read-only context boundary before UI or real-data publication; coordinate with the sevaro-ops Asana delivery repair.

### 2026-07-17 · ChatGPT · Portfolio operating system implemented
- Did: audited routes/data/deployment; added validated source-controlled projects, features, intake, decisions, and sources; implemented `/admin/portfolio`; linked `/admin/improvements` through optional project IDs and safe repo aliases; documented reconciliation gaps and operating procedures.
- Files/links touched: `src/data/portfolio.json`, `src/lib/portfolio.ts`, `/admin/portfolio`, `/admin/improvements`, improvement Lambda source, `docs/portfolio/*`, July 16 Drive transcript `1HBIc2VCztf_xkU6RGvPqm44aIoioHojZ`.
- Decisions: projects remain distinct from features; private people data stays outside Hub; unsupported ideas remain deferred; no ownership or priority is inferred.
- Open questions / needs Claude: original idea-dump email; canonical private `memory/people` path; owner/priority verification; Rhea/Riya spelling and role; review of legacy roadmap ID cleanup as a separate change.
- Next: review the uncommitted diff; separately repair the pre-existing homepage roadmap type mismatch; then seek approval for any commit or production follow-up. Validation: 114 tests passed, portfolio integrity checks passed, the local admin route compiled and enforced authentication, and the production build stopped only at the documented legacy roadmap type error.

### 2026-07-13 · Claude Code · Handoff system initialized
- Did: created HANDOFF.md + AGENTS.md; pointed CLAUDE.md at HANDOFF.md
- Next: both AIs read HANDOFF.md first, update it last
