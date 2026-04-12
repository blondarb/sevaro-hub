# Sevaro Hub — Architecture

## Purpose

Splash page and admin dashboard for the Sevaro platform. Provides public marketing content, a feedback management system (collect, triage, analyze), cross-app What's New notifications, an Improvement Queue for tracking prompt/feature improvement work, and a Prompt Review interface for AI-powered prompt refinement. Hosted at `hub.neuroplans.app`.

## Core Data Flow

### Feedback Flow

```
Feedback submission (from other Sevaro apps)
  └─► API Gateway → Lambda: sevaro-feedback-api
        └─► DynamoDB (feedback records stored)
              └─► /api/feedback (Next.js, admin-protected)
                    ├─► Feedback list / detail UI  (src/app/feedback/)
                    ├─► Bedrock Sonnet  (pattern analysis)
                    └─► SES  (email notifications → feedback@neuroplans.app)
```

### What's New Flow

```
Admin POST /whats-new  (authenticated)
  └─► API Gateway → Lambda: sevaro-whats-new-api
        └─► DynamoDB: sevaro-whats-new (PK: appId, SK: timestamp)
              └─► Public GET /whats-new?appId=...
                    └─► <WhatsNewBadge /> rendered in any Sevaro app
```

### Improvement Queue Flow

```
Admin POST /improvements  (authenticated)
  └─► API Gateway → Lambda: sevaro-improvement-queue-api
        └─► DynamoDB: sevaro-improvement-queue (PK: repoName, SK: promptId)
              └─► Admin UI: src/app/admin/improvements/
```

### Auth Flow

```
Browser → /login → Cognito Hosted UI (OAuth)
  └─► Cognito issues JWT (ID token)
        └─► JWT verified server-side via jose (JWKS)
              └─► Admin check: email in ADMIN_EMAILS env var
                    └─► Protected routes: /feedback, /admin/*
```

## Main Components

| Component | Location | Role |
|-----------|----------|------|
| Splash / Landing | `src/app/page.tsx` | Public marketing page for Sevaro platform |
| Feedback Dashboard | `src/app/feedback/page.tsx` | Admin list of all feedback sessions |
| Feedback Detail | `src/app/feedback/[id]/` | Session detail: transcript, annotations, summary |
| Feedback Analysis | `src/app/feedback/analyze/` | Bedrock-powered pattern analysis over feedback corpus |
| What's New Admin | `src/app/admin/whats-new/` | Create/delete cross-app What's New entries |
| Improvement Queue | `src/app/admin/improvements/` | Track prompt improvement work items |
| Prompt Review | `src/app/admin/prompts/` | AI-assisted prompt refinement interface |
| Auth Provider | `src/components/AuthProvider.tsx` | Client-side Cognito session context |
| WhatsNewBadge | `src/components/WhatsNewBadge.tsx` | Reusable badge for use in other apps |
| NavBar | `src/components/NavBar.tsx` | Top navigation |
| What's New Lambda | `lambda/sevaro-whats-new-api/` | CRUD API + JWT verification |
| Improvement Queue Lambda | `lambda/sevaro-improvement-queue-api/` | CRUD API + JWT verification |
| Prompt Registry Lambda | `lambda/sevaro-prompt-registry-api/` | Prompt storage and retrieval |
| Feedback Lambda | External (`sevaro-feedback-api`) | Managed outside this repo |
