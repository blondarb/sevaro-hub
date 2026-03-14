# Interactive Milestone Drawer — Design Document

**Date:** 2026-03-13
**Status:** Approved

## Overview

Add clickable milestones to Sevaro Hub cards. Clicking a milestone opens a slide-out drawer with a description, Claude Code prompts (quick + full), and manual instructions. A JSON data file serves as the single source of truth for all milestone details, and the nightly sync task keeps it current.

## Data Model

**File:** `src/data/roadmap.json`

```json
{
  "projects": [
    {
      "id": "evidence-engine",
      "name": "Evidence Engine",
      "milestones": [
        {
          "id": "optimize-synthesis-speed",
          "title": "Optimize Haiku 4.5 synthesis speed (7-14s)",
          "status": "pending",
          "complexity": "medium",
          "description": "The Haiku 4.5 synthesis step takes 7-14s on complex queries...",
          "prerequisites": ["Bedrock access", "Evidence Engine repo cloned"],
          "keyFiles": ["src/lib/bedrock-converse.ts", "src/lib/evidence-tools.ts"],
          "quickPrompt": "In the Evidence Engine repo, optimize the Haiku 4.5 synthesis...",
          "fullPrompt": "## Context\n...\n## Acceptance Criteria\n...",
          "manualSteps": ["Open bedrock-converse.ts", "Find synthesize function...", "..."]
        }
      ]
    }
  ]
}
```

**Fields:**
- `id` — kebab-case, unique within project
- `title` — short display text (matches hub card numbered item)
- `status` — `pending` | `in-progress` | `done` | `draft`
- `complexity` — `low` | `medium` | `high`
- `description` — 2-3 sentences explaining the task and why it matters
- `prerequisites` — what must be true before starting
- `keyFiles` — relative paths in the project repo
- `quickPrompt` — 1-2 sentence Claude Code prompt, copy-pasteable
- `fullPrompt` — detailed prompt with context, file paths, acceptance criteria
- `manualSteps` — numbered list of manual instructions if not using Claude

## Drawer UI

**Component:** `src/components/MilestoneDrawer.tsx` (client component)

**Behavior:**
- Milestone text in hub cards becomes clickable (styled as links)
- Clicking opens a drawer that slides in from the right (400px wide, full height)
- Semi-transparent backdrop closes drawer on click
- URL updates to `?task=evidence-engine.optimize-synthesis-speed` (shareable)
- On page load, if `?task=` param exists, auto-open that milestone's drawer
- Close via X button, backdrop click, or Escape key

**Drawer layout (top to bottom):**
1. **Header** — milestone title + complexity badge + status badge
2. **Description** — plain text
3. **Prerequisites** — bullet list (if any)
4. **Key Files** — monospace list of file paths
5. **Quick Prompt** — highlighted box with copy button
6. **Full Prompt** — collapsed by default, expandable, with copy button
7. **Manual Steps** — numbered list

**Styling:** Pure CSS matching existing hub dark theme. No external dependencies.

## Nightly Sync Integration

**Updated `daily-hub-showcase-sync` SKILL.md — Step 3 additions:**

After reading each repo's CLAUDE.md "Body of Work":

1. Read `src/data/roadmap.json`
2. For each project, compare milestones against CLAUDE.md:
   - Items in "Recent" (completed) → set milestone status to `"done"`
   - New items in "In Progress"/"Planned" not in roadmap → add as `"draft"` milestones (title only, placeholder description/prompts)
   - Remove completed milestones from active list
3. Regenerate the `Next:` text in `page.tsx` from active milestones in `roadmap.json` (first 3-5 with status `pending` or `in-progress`)

**What the sync does NOT do:**
- Write detailed descriptions or Claude prompts (those are authored manually)
- Reorder milestones (order reflects priority)
- Touch milestones with status `in-progress` (preserves active work context)

## Implementation Sequence

1. Create `src/data/roadmap.json` with all ~45 milestones across 12 projects
2. Build `MilestoneDrawer.tsx` component
3. Update `page.tsx` to render milestones as clickable links and mount the drawer
4. Update `daily-hub-showcase-sync` SKILL.md with roadmap.json sync rules
5. Test locally, commit, push (auto-deploys via Amplify)
