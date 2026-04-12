# Sevaro Hub — Status

## Phase Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Splash / marketing page | Complete | WCAG 2.2 AA color-contrast fixed (23 violations resolved) |
| Cognito Hosted UI OAuth SSO | Complete | Replaced direct login; post-login redirect fixed |
| Feedback admin dashboard | Complete | Auth, status management, AI analysis, SES notifications (PR #4) |
| Feedback session detail | Complete | Transcript, annotations, summary display (PR #7) |
| What's New cross-app notifications | Complete | Admin UI + `<WhatsNewBadge />` component (PR #5) |
| Improvement Queue | Complete | Lambda + DynamoDB API, admin UI, Claude Code skill (PR #6) |
| Prompt Review page | Complete | AI-powered prompt refinement interface (PR #8) |
| SES production access | Planned | Currently sandbox — only verified recipients can receive email |
| Admin management page | Planned | View/add/remove administrators |

## What Works

- Public splash page at `hub.neuroplans.app`
- Cognito OAuth SSO login (Hosted UI)
- Feedback admin dashboard: list, detail (transcript/annotations), status management, AI pattern analysis
- SES email notifications (to verified addresses only while in sandbox)
- What's New cross-app notification system with admin CRUD
- `<WhatsNewBadge />` component usable in other Sevaro apps
- Improvement Queue with Lambda-backed API and admin UI
- Prompt Review / AI-assisted prompt refinement interface
- JWT-based admin access control via `ADMIN_EMAILS` env var

## Active Gaps

| Gap | Severity | Details |
|-----|----------|---------|
| SES sandbox mode | Medium | Cannot send email to unverified recipients; production access request needed |
| Admin management page | Low | No UI to add/remove administrators; must edit `ADMIN_EMAILS` env var |

## Next Priorities

1. Request SES production access
2. Build admin management page (view/add/remove administrators)
