# Sevaro Hub

- **What it is:** Splash page and admin dashboard for the Sevaro apps ecosystem. Includes feedback session management with Cognito auth, AI pattern analysis of feedback via Bedrock, and email notifications via SES. Also serves "What's New" and improvement-queue admin APIs consumed by other Sevaro apps. Deployed at hub.neuroplans.app.
- **Type:** code repo
- **Stack / tools:** Next.js 15 (App Router, SSR) on AWS Amplify, Amazon Cognito auth (shared SSO pool), AWS Bedrock (Sonnet) for feedback pattern analysis, AWS SES (DKIM verified), Lambda + API Gateway (feedback API, what's-new API, improvement-queue API), DynamoDB, Vitest.
- **How to run / test:** `npm run dev`, `npm run build`, `npm start`, `npm test` (vitest run), `npm run test:coverage`. Auto-deploys on push to `main`.
- **Key files / structure:**
  - `src/` — Next.js app source (dashboard, feedback admin, what's-new/improvements admin)
  - `lambda/` — Lambda source for the What's New and Improvement Queue APIs
  - `docs/` — project docs
  - `amplify.yml` — Amplify build config
- **Conventions:** See CLAUDE.md (note: the file is stored base64-encoded on disk in this repo — decode before reading). Admin access gated by `ADMIN_EMAILS` env var; JWT verified via Cognito JWKS on protected routes (`/feedback`, `/admin/whats-new`, `/admin/improvements`). UI must match the Sevaro Design System 1:1.
- **Current focus / handoff notes:** as of 2026-07-05, most recent merged work (PR #31) made the improvement-queue Lambda accept multiple Cognito app clients so both the Hub and the separate Scribe Feedback Board app can authenticate against it. Prior commits are automated daily roadmap/Body-of-Work sync entries tracking cross-repo status, not hub-specific feature work — check `git log` for the latest hub-specific PR before assuming daily-sync commits reflect current state.

<!-- Read by Claude Code, Claude Cowork, and OpenAI Codex. Auto-generated 2026-07-05 (Fable run); edit freely. -->
