# "What's New" — Cross-App Update Notifications

**Created**: 2026-03-17
**Status**: Phase 1 Complete (API + Admin UI + Badge in Hub)
**Priority**: P2
**Scope**: Hub (central API + admin UI) → all Sevaro apps (consumer widget)

## Overview

End users should see a subtle "What's New" indicator on every Sevaro app (Evidence Engine, OPSAmple, Chrome extensions, etc.) that shows recent improvements and fixes. Updates are managed centrally in Hub and consumed by each app.

## Architecture

### Central "What's New" API (Hub)

**DynamoDB Table: `sevaro-whats-new`**
```
PK: appId (e.g., "evidence-engine", "neuroscribe-extension", "all")
SK: timestamp (ISO 8601)
Fields:
  - title: string ("Fixed dot phrase expansion")
  - description: string (1-2 sentences)
  - category: "fix" | "feature" | "improvement"
  - version: string (optional, e.g., "1.2.0")
  - link: string (optional, URL to docs/changelog)
  - createdBy: string
  - createdAt: ISO timestamp
```

- `appId = "all"` entries show on every app
- Each app queries for its own entries + "all" entries

**Lambda: `sevaro-whats-new-api`**
- `GET /whats-new?appId=evidence-engine&since=2026-03-01` — returns updates for an app since a date
- `POST /whats-new` — admin creates an update entry (auth required)
- `DELETE /whats-new/{id}` — admin removes an entry

**API Gateway**: Add routes to existing Hub API or create new endpoint

### Admin UI (Hub Dashboard)

New page: `/admin/whats-new`
- List all update entries across apps
- Create new entry: select app(s), title, description, category
- Edit/delete entries
- Preview how it looks in the widget

### Auto-Population via Improvement Queue

When the improvement queue skill completes work and commits:
1. The session prompt includes "after commit + test, add a What's New entry"
2. The prompt calls `POST /whats-new` with the fix description
3. Entry goes live immediately for end users

### Consumer Widget (Embedded in All Apps)

**`<WhatsNewBadge />`** component:
- Small indicator (dot, asterisk, or bell icon) in app header/nav
- Shows count of unseen updates (tracked via `localStorage` last-seen timestamp)
- Click → dropdown/modal showing recent updates with titles + descriptions
- "Mark all as read" clears the badge
- Fetches from Hub API on page load (cached for 1 hour)

**For Chrome Extensions:**
- Same concept but in the side panel header
- Badge on the extension icon (Chrome `chrome.action.setBadgeText`)
- Updates fetched from Hub API in background worker

### Standalone Widget Script

For apps that aren't React/Next.js:
```html
<script src="https://hub.neuroplans.app/whats-new-widget.js"></script>
<script>SevaroWhatsNew.init({ appId: 'evidence-engine', position: 'top-right' })</script>
```

## Steps

1. Create DynamoDB table `sevaro-whats-new`
2. Create Lambda `sevaro-whats-new-api` with GET/POST/DELETE
3. Build admin UI at `/admin/whats-new` in Hub
4. Build `<WhatsNewBadge />` React component
5. Integrate into Hub (dogfood)
6. Integrate into Evidence Engine web app
7. Integrate into Chrome extensions (side panel + badge)
8. Build standalone widget script for non-React apps
9. Add auto-population step to improvement queue prompts

## Files

- New Lambda: `lambda/sevaro-whats-new-api/`
- Hub admin: `src/app/admin/whats-new/page.tsx`
- Widget component: `src/components/WhatsNewBadge.tsx` (Hub, reusable)
- Standalone script: `public/whats-new-widget.js`
- Each app: add `<WhatsNewBadge appId="..." />` to layout/nav
