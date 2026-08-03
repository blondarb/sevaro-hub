# Sevaro Hub Portfolio Operating Guide

## Source of truth

- Projects, source-controlled features, raw ideas, decisions, and sources:
  `src/data/portfolio.json`.
- Executable improvement prompts: `/admin/improvements` and its existing
  DynamoDB/Lambda API.
- Private people memory: the existing private `memory/people` system. Do not
  store private notes or sensitive actions in this repo, and do not use
  `Contacts.md`.

Run `pnpm validate:portfolio` after every data edit. Validation rejects duplicate
IDs, missing project fields, broken source references, orphaned features,
unknown dependencies, and invalid decision/intake links.

## Add a source first

Every new record needs at least one source reference. Add a source under
`sources` with a stable `source-*` ID, a durable reference, source/access dates,
and one of these verification states:

- `verified`: the cited source was inspected and directly supports the claim.
- `partially_verified`: the source supports the theme but not the complete
  record.
- `needs_verification`: the source is unavailable, ambiguous, or only a
  provisional planning input.

## Add a private person

First confirm the canonical private `memory/people` path. Do not create a second
people system in this repo. A private record should use this portable contract:

```yaml
id: person-stable-id
name: Verified name
role_team: Verified professional role or team
professional_context:
  - Source-backed strength or working context
linked_project_ids: []
linked_feature_ids: []
responsibilities: []
sources: []
last_verified: YYYY-MM-DD
confidence: verified | partially_verified | needs_verification
```

Only the stable person ID belongs in shared project `sponsorIds`, `leadIds`,
`collaboratorIds`, feature `ownerIds`, or decision `relatedPersonIds`. Never copy
private relationship notes, sensitive personal details, compensation, PHI, or
credentials into `portfolio.json`.

## Add a project

Add a `project-*` record under `projects`. A project is an outcome-bearing
portfolio workstream, not a task or feature. Required operating fields include:

- one-sentence outcome and problem/opportunity;
- stage, priority, planning horizon, workstream, and team;
- sponsor/lead/collaborator private IDs, left empty until verified;
- a concrete next action;
- milestones, dependencies, and risks;
- source references, last-updated date, and verification state;
- repository aliases only when the mapping is known.

Do not infer an owner or priority from a conversation mention or repository
name. Use `unranked` and empty owner arrays until verified.

## Add a feature or initiative

Add a `feature-*` record under `features` and set `parentProjectId` to an existing
project. A feature describes a user need and bounded value/scope. Record its own
stage, owner IDs, dependencies, acceptance criteria, sources, verification, and
disposition.

Projects and features must never share an ID or be represented as the same row.

## Add a raw idea

Add an `idea-*` record under `rawIdeas` before promoting uncertain work. Leave
destinations null when the project relationship is unknown. Use
`triageStatus: untriaged` and describe the unresolved question. Promotion means
creating or linking a project/feature and updating the disposition; it does not
mean deleting the intake history.

## Add a decision

Add a dated `decision-*` record under `decisions`. Summarize the decision and
rationale, then link the affected project, feature, and private person IDs. The
decision log is append-only; supersede a decision with a new record rather than
rewriting history.

## Link an improvement-queue item

New or updated queue items may include `parentProjectId`. Existing rows without
it remain compatible and can link through an exact declared `repoAliases`
match. Use `/admin/improvements` to find `Unlinked` rows. Do not assign a project
based on title similarity alone.

## Review cadence

At least weekly:

1. Review untriaged ideas and unlinked improvements.
2. Resolve missing owners and next actions only from a verified source or an
   explicit decision.
3. Review blocked work and records older than 30 days.
4. Update decision history and source verification.
5. Run portfolio validation, tests, typecheck, and build before merging.

