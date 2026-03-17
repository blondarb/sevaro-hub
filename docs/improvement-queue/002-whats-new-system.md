---
id: hub-002
title: Cross-app "What's New" update notification system
priority: P2
status: pending
repo: sevaro-hub
plan: docs/plans/2026-03-17-whats-new-system.md
estimated_scope: large
created: 2026-03-17
completed: null
---

## Prompt

In the sevaro-hub repo (`/Users/stevearbogast/dev/repos/sevaro-hub/`), build a central "What's New" system that lets end users see recent fixes and improvements across all Sevaro apps.

Read `docs/plans/2026-03-17-whats-new-system.md` for the full plan.

**Phase 1 — Central API + Admin UI (this session):**

1. Create DynamoDB table `sevaro-whats-new` with `appId` (PK) + `timestamp` (SK) + title, description, category (fix/feature/improvement), version, link
2. Create Lambda `sevaro-whats-new-api` with:
   - `GET /whats-new?appId=evidence-engine&since=2026-03-01` — returns updates
   - `POST /whats-new` — admin creates entry (auth required)
   - `DELETE /whats-new/{id}` — admin removes entry
3. Build admin page at `/admin/whats-new` — list all entries, create/edit/delete, filter by app
4. Build a reusable `<WhatsNewBadge />` React component — shows dot/count of unseen updates, click opens dropdown with update list, "Mark all read" button. Tracks last-seen via localStorage.
5. Add `<WhatsNewBadge appId="sevaro-hub" />` to the Hub nav bar as dogfood

Use `--profile sevaro-sandbox` for AWS. `appId = "all"` entries show on every app.

**Phase 2 (separate sessions per app):** Integrate `<WhatsNewBadge />` into Evidence Engine, OPSAmple, Chrome extensions, etc. Each app gets its own integration prompt.

After implementing Phase 1, run `/codex-review`. Commit when working.
