# Sevaro Hub — Context Router

## Task → Context

| Task | Files to Read |
|------|--------------|
| Modify splash / marketing page | `src/app/page.tsx`, `src/app/layout.tsx` |
| Feedback admin dashboard | `src/app/feedback/`, `src/lib/feedback-api.ts`, `src/app/api/feedback/` |
| Feedback AI pattern analysis | `src/app/feedback/analyze/`, `src/app/api/feedback/` |
| What's New / cross-app notifications | `src/app/admin/whats-new/`, `src/lib/whats-new-api.ts`, `src/components/WhatsNewBadge.tsx`, `lambda/sevaro-whats-new-api/` |
| Improvement Queue | `src/app/admin/improvements/`, `src/lib/improvement-queue-api.ts`, `lambda/sevaro-improvement-queue-api/` |
| Prompt Review / registry | `src/app/admin/prompts/`, `src/lib/prompt-registry-api.ts`, `lambda/sevaro-prompt-registry-api/` |
| Auth / admin access control | `src/lib/auth.ts`, `src/lib/verify-auth.ts`, `src/components/AuthProvider.tsx`, `src/app/login/` |
| Email notifications (SES) | `src/app/api/feedback/`, `src/lib/feedback-api.ts` |
| Nav or layout changes | `src/components/NavBar.tsx`, `src/app/layout.tsx` |
| Lambda functions | `lambda/<function-name>/` |

## Quick Facts

| Fact | Value |
|------|-------|
| Framework | Next.js 15 (App Router, SSR) |
| Language | TypeScript |
| Package manager | pnpm |
| Hosting | AWS Amplify (`d3n3e9vr1knkam`) |
| Production URL | `hub.neuroplans.app` |
| Deploy | Auto-deploy on push to `main` |
| Auth | Amazon Cognito (`us-east-2_Owfb1zpgM`, client `7t8bjj2fjkvtu081qhledc627a`); JWT via `jose` |
| Admin access | Controlled by `ADMIN_EMAILS` env var (default: `steve@sevaro.com`) |
| AI | Bedrock Sonnet (feedback pattern analysis) |
| Email | SES from `feedback@neuroplans.app` (sandbox mode — only verified recipients) |
| Feedback API | Lambda `sevaro-feedback-api` via API Gateway `8uagz9y5bh` |
| What's New API | Lambda `sevaro-whats-new-api` via API Gateway `5168ofhh8k` |
| Improvement Queue API | Lambda `sevaro-improvement-queue-api` via API Gateway `ael0orzmsk` |
| Styling | Tailwind CSS (no shadcn — minimal deps) |

## File Index

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Public splash / landing page |
| `src/app/layout.tsx` | Root layout with NavBar |
| `src/app/login/` | Cognito Hosted UI OAuth login |
| `src/app/feedback/` | Feedback admin dashboard (protected) |
| `src/app/feedback/[id]/` | Individual feedback session detail with transcript/annotations |
| `src/app/feedback/analyze/` | AI pattern analysis over feedback corpus |
| `src/app/admin/whats-new/` | What's New cross-app notification admin |
| `src/app/admin/improvements/` | Improvement Queue admin UI |
| `src/app/admin/prompts/` | Prompt Review / registry admin UI |
| `src/app/api/feedback/` | Feedback API route (proxies Lambda, triggers SES) |
| `src/app/api/auth/` | Auth API routes |
| `src/app/api/admin/` | Admin API routes |
| `src/app/api/prompts/` | Prompt registry API routes |
| `src/lib/auth.ts` | Auth utilities |
| `src/lib/verify-auth.ts` | JWT verification helpers |
| `src/lib/feedback-api.ts` | Feedback Lambda client |
| `src/lib/whats-new-api.ts` | What's New Lambda client |
| `src/lib/improvement-queue-api.ts` | Improvement Queue Lambda client |
| `src/lib/prompt-registry-api.ts` | Prompt Registry Lambda client |
| `src/components/AuthProvider.tsx` | Client-side auth context |
| `src/components/WhatsNewBadge.tsx` | Cross-app What's New badge component |
| `src/components/NavBar.tsx` | Top navigation bar |
| `src/components/MilestoneDrawer.tsx` | Milestone / roadmap drawer component |
| `lambda/sevaro-whats-new-api/` | What's New Lambda source |
| `lambda/sevaro-improvement-queue-api/` | Improvement Queue Lambda source |
| `lambda/sevaro-prompt-registry-api/` | Prompt Registry Lambda source |
| `docs/` | Handoff notes and plans |
