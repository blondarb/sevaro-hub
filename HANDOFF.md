# HANDOFF — sevaro-hub

_Single source of truth for cross-AI handoffs. Claude (Cowork/Claude Code) and
ChatGPT/Codex read this FIRST and update it LAST. Plain language. No PHI (initials
only). No secrets._

## Snapshot (keep current)
- Status: Active — a source-controlled portfolio operating system is implemented on the uncommitted `codex/portfolio-operating-system` worktree for review.
- Driver this week: Review the validated `/admin/portfolio` change, reconcile the unavailable original idea-dump email, and confirm the private `memory/people` location before assigning owners.
- Lives in: https://github.com/blondarb/sevaro-hub.git

## Open threads / next actions
- [ ] Retrieve and reconcile the original idea-dump email; current Outlook access reached MFA and was not completed.
- [ ] Confirm the canonical private `memory/people` path; do not create a duplicate or modify `Contacts.md`.
- [ ] Review provisional project scope, ownership, priority, and Rhea/Riya spelling before marking records verified.
- [ ] Obtain review before committing, pushing, deploying, or changing production improvement rows.

## Decisions log (append-only, newest first)

## Session log (append-only, newest first)
### 2026-07-17 · ChatGPT · Portfolio operating system implemented
- Did: audited routes/data/deployment; added validated source-controlled projects, features, intake, decisions, and sources; implemented `/admin/portfolio`; linked `/admin/improvements` through optional project IDs and safe repo aliases; documented reconciliation gaps and operating procedures.
- Files/links touched: `src/data/portfolio.json`, `src/lib/portfolio.ts`, `/admin/portfolio`, `/admin/improvements`, improvement Lambda source, `docs/portfolio/*`, July 16 Drive transcript `1HBIc2VCztf_xkU6RGvPqm44aIoioHojZ`.
- Decisions: projects remain distinct from features; private people data stays outside Hub; unsupported ideas remain deferred; no ownership or priority is inferred.
- Open questions / needs Claude: original idea-dump email; canonical private `memory/people` path; owner/priority verification; Rhea/Riya spelling and role; review of legacy roadmap ID cleanup as a separate change.
- Next: review the uncommitted diff; separately repair the pre-existing homepage roadmap type mismatch; then seek approval for any commit or production follow-up. Validation: 114 tests passed, portfolio integrity checks passed, the local admin route compiled and enforced authentication, and the production build stopped only at the documented legacy roadmap type error.

### 2026-07-13 · Claude Code · Handoff system initialized
- Did: created HANDOFF.md + AGENTS.md; pointed CLAUDE.md at HANDOFF.md
- Next: both AIs read HANDOFF.md first, update it last
