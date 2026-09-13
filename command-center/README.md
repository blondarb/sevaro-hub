# Read-only executive context integration

This code is the integration home for the existing private Site. It produces a
short-lived projection, not editable project records. Asana remains authoritative;
Claude/Cowork/Code retain their existing Outlook, Fyxer, Slack and document routines.

## Current capabilities and boundaries

- Exact-task Asana GET adapter requests IDs, completion, due dates, source revisions
  and section IDs only. Reviewed section-ID labels preserve Asana's stages. A moved
  task, unknown section or failed partial read marks the source unavailable.
- GitHub uses the host's existing `gh` authentication and GraphQL field selection
  for exact PR numbers/state/draft/revision. It never fetches PR bodies or logs.
- Claude supplies an already-reviewed export with source-linked decisions, replies,
  delegated work or meeting preparation. There is deliberately no raw mail, Slack,
  transcript, calendar or document parser here. Codex does not connect to Slack.
- Sync health reads the repaired writer's actionable count and original observation
  time. An old incompatible monitor file is unavailable, never silently interpreted
  as the 43 historical entries being failed writes. Upgrade remains cutover-gated.
- Assembly refuses duplicate/conflicting IDs, unknown fields, unapproved hosts,
  future observations, stale-source items and invalid dates. It excludes quiet records before creating one
  deterministic item-number map with a content-derived snapshot and view ID.
- Site runtime accepts one protected snapshot setting plus its exact approved digest.
  Real-data mode is disabled unless separately enabled after the acceptance gates.
  All reads use the exact displayed pins; deployment of a new snapshot makes old
  references fail rather than silently resolving a newly numbered item.
- Numbered tools use an integer, not raw speech in a URL. External writes, sending,
  assignments and approvals are not implemented in this phase.

These validators are **not a PHI detector**. Every title, label, source URL and
free-text field can contain identifying information. Source scope and content
review must occur before creating any input accepted by this module. A classification
field or hash is not evidence that content is safe or that Steve approved it.

## Host operation

`node command-center/cli.mjs collect PRIVATE_PLAN PRIVATE_OUTPUT` reads an exact
reviewed source plan, collects supported metadata/curated exports and prepares a
private proposed snapshot. `prepare` consumes already-curated source feeds instead.
The CLI always labels output `executive-pending-review`, which the runtime rejects.
It never approves or publishes. It prints only a digest, expiry and count.
Output must be directly in `~/ClaudeSync/handoffs/command-center`, mode 0600, outside
Git. The output filename is `proposed-current-context.json`; its previous value
rotates into `proposed-prior-context.json`. Inputs must live directly in that private
folder and be owner-private regular files, with no symlink or repository ancestors;
there is no automated history, report schedule or new background agent.

A plan has `schema_version: 1` and `sources`. Each source uses exactly these keys:

| system | keys in addition to source_id and system |
| --- | --- |
| asana | project_id, entries, stage_labels |
| github | repository, entries |
| claude | private_export_path, allowed_hosts |
| asana_sync | private_health_path, source_url |

Each reviewed Asana/GitHub `entries` record has target, spoken_name, kind, context,
recommendation (nullable), requires_steve, next_event (nullable), action_state.
These labels/classifications/interpretations are curated proposals, never inferred
business assignments. `stage_labels` maps reviewed Asana section GIDs to their
exact labels, including emoji where present. The canonical upstream values win.
No source config or real examples are checked into this public repository.

## Protected release channel

1. Collect and inspect the **exact** private output locally. Resolve content/source
   conflicts; exclude anything not confirmed PHI-free. Keep FPPE and SDNE stage
   conflicts as decisions for Steve, not automatic edits.
2. Revalidate source revisions and approval immediately before release. Any changed
   source/content invalidates the previous release approval; recollect and review.
3. `prepareRelease` validates the canonical payload and enforces a conservative
   4096-byte cap. Do not compress, shard or truncate it to evade the cap. The
   platform's documented maximum and retention are not established by this code.
4. The operator may mark the exact inspected snapshot `executive-reviewed` only
   after Steve approves its content. Recompute its snapshot/view hashes, then record
   an independent `CONTEXT_APPROVAL_RECEIPT` with the released digest, approved_by
   `Steve`, approved_at, expires_at (no later than the snapshot), and scope
   `owner-only-read-only-site`. There is no auto-approval command. Runtime requires
   this exact unexpired receipt as well as the real-data gate. A receipt records a
   human decision; generating its fields does not constitute that decision.
   After exact-content approval, the Site-owning operator uses the platform's
   protected environment-variable API to set `CONTEXT_SNAPSHOT` (secret) and
   `CONTEXT_RELEASE_SHA256` and the secret approval receipt together, then redeploys the same saved source version.
   Environment edits do not affect the running Site until that deployment succeeds.
   Do not use shell arguments, public assets, Git or a new database to transfer data.
5. The trusted operator must verify hosted owner/anonymous/other-account access,
   synthetic A-to-B digest consistency, old-pin refusal, no payload in logs, and
   native Voice equivalence before setting `CONTEXT_REAL_DATA_ENABLED=approved`.
   The flag is an operational gate, not a substitute for those receipts or a PHI
   review. Only the Site owner may change runtime settings; source permissions stay
   in their original systems. No automated uploader or auto-approval exists.
6. Verify the resulting snapshot/view/digest and expiry through owner-authenticated
   Site reads and Voice. Never count a bypass-token response as visitor acceptance.

This is a manual/on-demand snapshot release channel, **not an unattended sync**.
Existing routines can prepare exports after their review contract is adopted;
automatic publication remains off. Freshness expiry means the Site will show
unavailable until a reviewed refresh is released. Do not claim current data while
presenting an expired snapshot. The platform may retain old setting revisions;
retention/purge behavior needs verification before sensitive executive content.

Rollback clears `CONTEXT_SNAPSHOT`, `CONTEXT_RELEASE_SHA256`,
`CONTEXT_APPROVAL_RECEIPT` and `CONTEXT_REAL_DATA_ENABLED` and redeploys the
same saved version, returning to the immutable synthetic proof (until its expiry).
Preserve owner binding. Do not restore expired/unapproved real content. No source
system is mutated by rollback.

## Tests

`node --test command-center/test/*.test.mjs command-center-proof/context.test.mjs`

Tests use only invented IDs, labels and source responses. Hosted deployment,
real-feed permission, second-account denial and actual Voice acceptance are
separate receipts, not implied by these tests.
