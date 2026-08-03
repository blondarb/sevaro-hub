# Portfolio Operating System Design

## Goal

Make `/admin/portfolio` the durable project-level source of truth in Sevaro Hub,
while keeping feature/improvement work linked, traceable, and distinct from
private people memory.

## Constraints

- The deployed site remains `hub.neuroplans.app`; no other app or domain is
  introduced.
- No production data, configuration, credentials, access grants, messages,
  deployment, or remote services are changed in this worktree.
- The original idea-dump email is unavailable. Items supplied in the July 17
  request remain `needs_verification` unless another identified source supports
  them.
- Private people records stay outside this shared repository. The repository
  documents their portable contract and stores only non-sensitive IDs in shared
  relationship fields.
- Existing DynamoDB improvement records remain readable. New linkage fields are
  optional and backwards compatible.

## Architecture

`src/data/portfolio.json` is the source-controlled operating dataset. It holds
sources, projects, features, raw ideas, and decisions with stable IDs and
explicit references. `src/lib/portfolio.ts` owns types, validation, filtering,
health flags, and improvement-to-project resolution. No project state is
silently inferred from repository activity.

`/admin/portfolio` renders the project board from that dataset, supports the
required filters and Now/Next/Later views, and exposes linked features,
dependencies, sources, verification state, and decision history. The existing
`/admin/improvements` queue remains DynamoDB-backed; it gains an optional
`parentProjectId` and displays either an explicit project link, a verified repo
alias match, or an unlinked warning.

The older `src/data/roadmap.json` continues to power the public project-card
milestone drawer. It is not silently migrated because its records are partly
stale and several hard-coded card IDs are disconnected. The audit and operating
guide document that boundary.

## Data boundaries

### Private people

The private record contract includes stable ID, name, role/team, professional
context, linked shared IDs, responsibilities, source, last verified date, and
confidence. Actual records and sensitive action queues do not enter this repo.
Names may appear in the reconciliation matrix only where needed to identify an
unresolved source item; no personal, compensation, relationship, or PHI details
are stored.

### Shared portfolio

Projects require outcome, problem/opportunity, stage, priority, workstream,
planning horizon, next action, source references, updated date, and verification
state. Sponsor, lead, collaborator, milestone, dependency, and risk fields are
present but may be empty when unverified.

Features require a parent project and carry their own user need, value/scope,
stage, owner, dependencies, acceptance criteria, source references,
verification state, and disposition.

Raw ideas are deliberately untriaged and decisions are append-only records that
can reference projects, features, and private person IDs.

## Source and confidence policy

Every seeded record cites either the July 16 Drive transcript or the explicitly
provisional July 17 user-supplied list. Unsupported ownership, priority, and
status remain `unassigned`, `unranked`, or `needs_verification`. OPPE/FPPE,
TelestrokeBench, and RCM/admin automation remain raw ideas unless a source is
found. Job-description, reporting, and compensation work is excluded from the
shared board and recorded only as a private-location gap.

## Validation

Automated checks reject duplicate IDs, missing required fields, unknown source
references, orphaned features, broken dependency links, unknown project/person
references, and explicit improvement links to missing projects. Component tests
exercise filtering, health flags, project detail, and distinction between
projects and features. Full test, TypeScript, build, and rendered checks are run
before handoff.

