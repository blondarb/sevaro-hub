---
id: hub-003
title: Improvement queue skill and tracking system
priority: P2
status: pending
repo: sevaro-hub
plan: docs/plans/2026-03-17-improvement-queue-skill.md
estimated_scope: large
created: 2026-03-17
completed: null
---

## Prompt

Build the improvement queue infrastructure — a system where improvement ideas are stored as structured prompts in each repo, tracked centrally in Hub, and executable via a Claude Code skill.

Read `docs/plans/2026-03-17-improvement-queue-skill.md` for the full plan.

This has three parts:

**Part 1 — Hub Admin Page (`/admin/improvements`):**
In the sevaro-hub repo (`/Users/stevearbogast/dev/repos/sevaro-hub/`):
1. Create a DynamoDB table `sevaro-improvement-queue` with `repoName` (PK) + `promptId` (SK) + title, priority, status, estimatedScope, planFile, promptFile, timestamps
2. Create Lambda `sevaro-improvement-queue-api` for CRUD
3. Build admin page at `/admin/improvements` — list all prompts across repos, filter by repo/priority/status, "Copy Prompt" button, status tracking
4. Seed the table with all existing prompt files from `docs/improvement-queue/` directories across repos

**Part 2 — Claude Code Skill:**
Create skill at `~/.claude/skills/improvement-queue/SKILL.md` that:
1. Scans all repos' `docs/improvement-queue/` directories for pending prompts
2. Lists them sorted by priority
3. User selects which to work on
4. Reads the prompt + linked plan
5. Presents the plan for approval
6. User copies the prompt to a new session (or works in current session)

**Part 3 — Sync:**
After any improvement prompt is completed (status → completed), the prompt suggests creating a What's New entry via the `sevaro-whats-new-api`.

Use `--profile sevaro-sandbox` for AWS. After implementing, run `/codex-review`. Commit when working.
