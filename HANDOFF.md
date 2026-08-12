# HANDOFF — sevaro-hub

_Single source of truth for cross-AI handoffs. Claude (Cowork/Claude Code) and
ChatGPT/Codex read this FIRST and update it LAST. Plain language. No PHI (initials
only). No secrets._

## Snapshot (keep current)
- Status: Active — verified July 5, 2026; most recent hub-specific work (PR #31) let the improvement-queue Lambda accept multiple Cognito app clients.
- Driver this week: Planned work is an admin management page (view/add/remove administrators) and requesting SES production access (currently sandbox-only).
- Lives in: https://github.com/blondarb/sevaro-hub.git
- Local-alpha status dashboard draft PR [#35](https://github.com/blondarb/sevaro-hub/pull/35) is complete. It is a separate loopback-only tool outside Next/Amplify, passes 115 tests, and has independent security/data-integrity GO. A real browser accepted Ready, 16/16 checks, 4/4 repositories, 5 Asana projects, every prohibited capability OFF, audit ON, and no console warnings/errors. It is not deployed. Companion backend draft PR: [#33](https://github.com/blondarb/sevaro-agent-memory/pull/33).

## Open threads / next actions
- [ ] Review local-alpha dashboard draft PR [#35](https://github.com/blondarb/sevaro-hub/pull/35). Do not merge it to auto-deploying `main` without a separate production decision.
- [ ] The unchanged `src/app/page.tsx` milestone-data typing error still blocks the baseline production build; this branch adds no TypeScript error.

## Decisions log (append-only, newest first)

## Session log (append-only, newest first)
### 2026-08-12 · ChatGPT · Exact-eleven local dashboard contract
- Did: updated the separate loopback dashboard/proxy to accept only the merged backend's exact-eleven read-only tool count (six repository tools, four Asana tools, and `get_project_context_pack`); focused tests explicitly reject legacy ten and other count drift.
- Files/links touched: `tools/control-plane-local/server.mjs`; `test/tools/control-plane-local/server.test.ts`; this handoff.
- Decisions: This remains a local nonproduction operator tool outside Next/Amplify; it neither contacts sources nor enables PHI, content, writes, scheduling, remote MCP, or production.
- Open questions / needs Claude: None.
- Next: Review the narrowly updated local-dashboard draft; do not merge to auto-deploying `main` without a separate production decision.

### 2026-08-12 · ChatGPT · Exact-ten local dashboard contract
- Did: updated the separate loopback dashboard/proxy to accept and display the backend's exact-ten read-only tool contract; retained its exact 16 readiness checks, exact-four repository allowlist, and all prohibited boundaries OFF.
- Files/links touched: `tools/control-plane-local/server.mjs`; `test/tools/control-plane-local/server.test.ts`; this handoff.
- Decisions: This remains a local nonproduction operator tool outside Next/Amplify; it neither contacts sources nor enables PHI, content, writes, scheduling, remote MCP, or production.
- Open questions / needs Claude: None.
- Next: Review the narrowly updated local-dashboard draft; do not merge to auto-deploying `main` without a separate production decision.

### 2026-08-06 · ChatGPT · Exact-eight local dashboard accepted
- Did: updated the separate local dashboard/proxy to the exact 16-check, exact-eight backend contract; added exact schema reconstruction and mixed active/archived project coverage; ran all 115 tests; and accepted the final loopback dashboard in a real browser against clean backend runtime `af5f12e`.
- Files/links touched: draft Hub PR [#35](https://github.com/blondarb/sevaro-hub/pull/35); `tools/control-plane-local/`; `test/tools/control-plane-local/`; companion backend draft PR [#33](https://github.com/blondarb/sevaro-agent-memory/pull/33); and this handoff.
- Decisions: Keep the dashboard structurally outside Next/Amplify and local nonproduction only. It has no source credential, source contact, mutation path, scheduler, remote transport, PHI path, or production activation. Do not merge PR #35 without a separate production decision.
- Open questions / needs Claude: None for manual local-alpha use. The unchanged production-page milestone typing mismatch remains outside this tranche.
- Next: Review PR #35 as a local tool only and keep it draft. Expand product intelligence in the backend before considering any production UI integration.

### 2026-08-05 · ChatGPT · Local control-plane status dashboard
- Did: added a structurally separate Node/static dashboard at `tools/control-plane-local/`; it binds only to an explicit `127.0.0.1` port (1024–65535), refuses production mode, requires explicit local enablement and a fixed plain-HTTP `127.0.0.1/v1/status` upstream, proxies only marked same-origin GET status through a server-side bearer of at least 32 characters, enforces the exact ordered 15-check/exact-four contract, adds browser-hardening response headers, and returns generic failures. Real-browser acceptance showed the correct 14/15 blocked state with zero rows after the short lease expired. Focused validation passed 12 tests and the full suite passed 114; direct TypeScript validation now reports only the unchanged baseline page error. Independent security/data-integrity re-review returned GO.
- Files/links touched: `tools/control-plane-local/`, `test/tools/control-plane-local/`, `package.json`.
- Decisions: this is a local nonproduction operator view only. It is outside `src/app`, Next routes, and Amplify configuration; backend addresses and credentials are never sent to the browser. Source/canonical writes are OFF and the previously approved constrained append-only local access audit is explicitly ON.
- Open questions / needs Claude: the existing Hub production build is currently blocked by an unrelated `src/app/page.tsx` roadmap-data type mismatch; no production source was changed here.
- Next: review the draft branch. Do not merge to auto-deploying `main` without a separate production gate. A new separately authorized permission refresh is required before the backend can show a ready state.

### 2026-07-13 · Claude Code · Handoff system initialized
- Did: created HANDOFF.md + AGENTS.md; pointed CLAUDE.md at HANDOFF.md
- Next: both AIs read HANDOFF.md first, update it last
