# Portfolio Operating System Implementation Plan

> **For agentic workers:** Implement inline in this worktree with test-driven development. Do not commit, push, deploy, or modify production state without explicit user approval.

**Goal:** Add a traceable, source-controlled portfolio operating system and link the existing improvement queue to it.

**Architecture:** A validated JSON dataset supplies projects, features, intake, decisions, and sources. Pure TypeScript helpers power a protected client-rendered portfolio board and backwards-compatible improvement linkage.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Testing Library, static JSON, existing AWS Lambda/DynamoDB queue.

---

### Task 1: Portfolio contracts and validation

**Files:**
- Create: `src/data/portfolio.json`
- Create: `src/lib/portfolio.ts`
- Test: `test/lib/portfolio.test.ts`
- Modify: `package.json`

- [ ] Write failing tests for required fields, duplicate IDs, broken sources, orphaned features, invalid dependencies, health flags, filters, and improvement linkage.
- [ ] Run the focused test and verify it fails because the portfolio module does not exist.
- [ ] Implement the minimum contracts and helpers needed for the tests.
- [ ] Seed only source-backed or explicitly provisional records.
- [ ] Run the focused test and verify it passes.

### Task 2: Portfolio board

**Files:**
- Create: `src/components/portfolio/PortfolioBoard.tsx`
- Create: `src/components/portfolio/portfolio.css`
- Create: `src/app/admin/portfolio/page.tsx`
- Test: `test/components/PortfolioBoard.test.tsx`

- [ ] Write failing component tests for project/feature distinction, filters, health warnings, Now/Next/Later, and expanded detail.
- [ ] Run the component test and verify the intended failure.
- [ ] Implement the protected page and reusable board using Sevaro design tokens.
- [ ] Run the component test and verify it passes.

### Task 3: Improvement queue linkage

**Files:**
- Modify: `src/lib/improvement-queue-api.ts`
- Modify: `src/app/admin/improvements/page.tsx`
- Modify: `lambda/sevaro-improvement-queue-api/index.mjs`
- Modify: `src/components/NavBar.tsx`
- Test: `test/lib/portfolio.test.ts`

- [ ] Add failing tests for explicit links, verified repo-alias fallback, and unlinked records.
- [ ] Implement optional `parentProjectId` support without changing existing keys or requiring a migration.
- [ ] Show linked project labels and an unlinked queue filter; add Portfolio navigation.
- [ ] Run the focused tests and verify they pass.

### Task 4: Reconciliation and operating docs

**Files:**
- Create: `docs/portfolio/OPERATING_GUIDE.md`
- Create: `docs/portfolio/IDEA_DUMP_RECONCILIATION_2026-07-17.md`
- Create: `docs/portfolio/AUDIT_2026-07-17.md`
- Modify: `HANDOFF.md`
- Modify: `CLAUDE.md`

- [ ] Document how to add each record type and where private people records belong.
- [ ] Record every supplied planning input with disposition, rationale, confidence, and source gap.
- [ ] Document stale roadmap mappings, persistence boundaries, and unresolved ownership.
- [ ] Add the required ChatGPT session entry at the top of the handoff session log.

### Task 5: Verification

- [ ] Run portfolio data validation.
- [ ] Run the complete test suite.
- [ ] Run TypeScript without emission.
- [ ] Run the production build.
- [ ] Run the local app and validate the representative portfolio component/route without weakening authentication.
- [ ] Review `git diff` and confirm no private records, credentials, PHI, or unrelated changes are present.

