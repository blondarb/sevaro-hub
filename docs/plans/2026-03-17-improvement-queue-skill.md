# Improvement Queue Skill — Centralized Prompt-Driven Development

**Created**: 2026-03-17
**Status**: Implemented
**Priority**: P2
**Scope**: Workspace-level skill + per-repo prompt files + Hub tracking UI

## Overview

A system where improvement ideas are captured as structured prompts, stored in each repo, tracked centrally in Hub's database, and executable via a Claude Code skill. The human remains in the loop — they review the prompt, start a new session, and approve changes.

## Architecture

### Per-Repo Prompt Files

Each repo gets a `docs/improvement-queue/` directory with individual prompt files:

```markdown
# docs/improvement-queue/001-fix-dot-phrases.md
---
id: ee-001
title: Fix dot phrase expansion
priority: P1
status: pending  # pending | in-progress | completed | deferred
repo: sevaro-evidence-engine
plan: docs/plans/2026-03-17-dot-phrases-fix.md
estimated_scope: small  # small | medium | large
created: 2026-03-17
completed: null
---

## Prompt

In the sevaro-evidence-engine repo, the dot phrases feature in the Chrome extension
is not expanding when users type triggers like `.NN` in web page fields.

Read `docs/plans/2026-03-17-dot-phrases-fix.md` for the full investigation plan.
Debug the content script (`chrome-extension/src/content/dot-phrases.ts`), trace the
phrase loading from background worker, and fix the expansion logic. Test on the
Scribe Test Page at `hub.neuroplans.app/scribe-test.html`.

After fixing, run `/codex-review` to validate the changes.
```

### Central Tracking (Hub DynamoDB)

**Table: `sevaro-improvement-queue`**
```
PK: repoName
SK: promptId
Fields:
  - title, priority, status, estimatedScope
  - repoPath (local filesystem path)
  - planFile (relative path to plan doc)
  - promptFile (relative path to prompt file)
  - createdAt, completedAt
  - whatsNewEntry (ID of the What's New entry created on completion)
```

### Hub Admin Page: `/admin/improvements`

- List all improvement prompts across all repos
- Filter by repo, priority, status
- Click to view prompt + plan details
- "Copy Prompt" button → copies the session prompt to clipboard
- Status tracking: pending → in-progress → completed
- Link to What's New entry when completed

### Skill: `/improvement-queue`

**Invocation**: User runs `/improvement-queue` in Claude Code

**Behavior**:
1. Scans all repos' `docs/improvement-queue/` directories
2. Lists pending prompts sorted by priority
3. User selects which prompt to execute
4. Claude reads the prompt file + linked plan
5. Presents the plan to the user for approval
6. On approval: starts working (or user copies prompt to new session)
7. After completion: marks status as completed, suggests What's New entry

### Workflow

1. **Idea capture**: During any session (like this one), improvement prompts are written to repos
2. **Review**: User browses Hub's `/admin/improvements` or runs `/improvement-queue`
3. **Execute**: User copies prompt into a new Claude Code session in the right repo
4. **Complete**: Session finishes work, commits, runs codex-review
5. **Update**: Status set to completed, What's New entry created
6. **Notify**: End users see the update in their app

## Steps

1. Create the skill definition at `~/.claude/skills/improvement-queue/`
2. Create DynamoDB table `sevaro-improvement-queue`
3. Create Lambda for CRUD operations
4. Build Hub admin page at `/admin/improvements`
5. Seed initial prompts from this session's plans
6. Create prompt files in each repo's `docs/improvement-queue/`

## Files

- Skill: `~/.claude/skills/improvement-queue/SKILL.md`
- Hub admin: `src/app/admin/improvements/page.tsx`
- Lambda: `lambda/sevaro-improvement-queue-api/`
- Per-repo: `docs/improvement-queue/*.md` files
