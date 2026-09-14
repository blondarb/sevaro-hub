# Read-only executive context integration

This code is the integration home for the existing private Site. It produces a
short-lived projection, not editable project records. Asana remains authoritative;
Claude/Cowork/Code retain their existing Outlook, Fyxer, Slack and document routines.

## Current capabilities and boundaries

- Exact-task Asana GET adapter requests IDs, completion, due dates, source revisions
  and section IDs only. Reviewed section-ID labels preserve Asana's stages. A moved
  task, unknown section or failed partial read marks the source unavailable.
  An optional private `excluded_assignee_gids` list removes tasks assigned to those
  exact Asana users before snapshot construction. Steve requested excluding Dhruv's
  tasks from his view. The verified account ID stays in the private plan, not code.
  Reassignment is checked on every refresh; unassigned tasks remain eligible and
  missing owner metadata fails closed. Page and Voice share the same filtered snapshot.
- GitHub uses the host's existing `gh` authentication and GraphQL field selection
  for exact PR numbers/state/draft/revision. It never fetches PR bodies or logs.
- Claude supplies a schema-version-2 reviewed export envelope with feed and
  `{feed,run}` digests binding its outcome, coverage and run times, and
  actual run/coverage receipt, containing source-linked decisions, replies,
  delegated work or meeting preparation. There is deliberately no raw mail, Slack,
  transcript, calendar or document parser here. Codex does not connect to Slack.
  Partial runs enter only the explicit `partial` source state: fresh reviewed items
  can appear with a partial-coverage warning, never as available/complete coverage.
  Expired, failed and unavailable feeds contribute no items.
- Sync health reads the repaired writer's actionable count and original observation
  time. An old incompatible monitor file is unavailable, never silently interpreted
  as the 43 historical entries being failed writes. Upgrade remains cutover-gated.
- Assembly refuses duplicate/conflicting IDs, unknown fields, unapproved hosts,
  future observations, stale-source items and invalid dates. By default it excludes quiet records before creating one
  deterministic item-number map with a content-derived snapshot and view ID.
- Source URLs are HTTPS navigation links only. Query strings are refused except for
  the Microsoft Graph-documented event `webLink` route on
  `outlook.office365.com/owa/` with exactly `itemid`, `exvsurl=1`, and
  `path=/calendar/item`. The reviewed source must provide that exact link; never
  synthesize a calendar URL or add redirect, token, or return parameters.
- Claude-reviewed Slack findings may link only to the observed message permalink
  on `sevarohealth.slack.com/archives/{channel}/p{timestamp}` without query,
  fragment, credentials or redirects. This is navigation only, not a Slack
  connector, monitoring permission or source-content fetch.
- Site runtime accepts one protected snapshot or protected transport chunks, plus its exact approved digest.
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

Existing-routine export adoption and quiet refresh preparation: see
[CLAUDE_EXPORT_ADOPTION.md](../docs/command-center/CLAUDE_EXPORT_ADOPTION.md).
`refresh-cli.mjs` prepares pending snapshots and fixed health metadata only; it
never approves, publishes, renews a Site release, or dispatches a notification.


`node command-center/cli.mjs collect PRIVATE_PLAN PRIVATE_OUTPUT` reads an exact
reviewed source plan, collects supported metadata/curated exports and prepares a
private proposed snapshot. `prepare` consumes already-curated source feeds instead.
The CLI always labels output `executive-pending-review`, which the runtime rejects.
It never approves or publishes. It prints only a digest, expiry and count.
Output must be directly in `~/ClaudeSync/handoffs/command-center`, mode 0600, outside
Git. The output filename is `proposed-current-context.json`; its previous value
rotates into `proposed-prior-context.json`. Inputs must live directly in that private
folder and be owner-private regular files outside repositories. The documented ClaudeSync
root alias is resolved once to its existing Google Drive location; unknown aliases and
symlinked leaf files are refused;
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
For Asana only, the optional `excluded_assignee_gids` key adds an exact-owner
exclusion. It changes the projection, never Asana task ownership or status.

## Protected release channel

1. Collect and inspect the **exact** private output locally. Resolve content/source
   conflicts; exclude anything not confirmed PHI-free. Keep FPPE and SDNE stage
   conflicts as decisions for Steve, not automatic edits.
2. Revalidate source revisions and approval immediately before release. Any changed
   source/content invalidates the previous release approval; recollect and review.
3. `prepareRelease` validates the canonical payload and enforces a conservative
   65536-byte total cap. Do not compress, shard or truncate to evade that cap.
   Hosted testing established an additional per-binding limit of about 5.1 kB.
   `snapshotBindings(payload)` splits the unchanged canonical payload into UTF-8
   chunks of at most 4096 bytes, with a count. All chunks are rejoined and checked
   against the same complete snapshot digest and approval; no data is dropped.
4. The operator may mark the exact inspected snapshot `executive-reviewed` only
   after Steve approves its content. Recompute its snapshot/view hashes, then record
   an independent `CONTEXT_APPROVAL_RECEIPT` with the released digest, approved_by
   `Steve`, approved_at, expires_at (no later than the snapshot), and scope
   `owner-only-read-only-site`. There is no auto-approval command. Runtime requires
   this exact unexpired receipt as well as the real-data gate. A receipt records a
   human decision; generating its fields does not constitute that decision.
   After exact-content approval, the Site-owning operator uses the platform's
   protected environment-variable API to set `CONTEXT_SNAPSHOT` (secret), or the
   secret `CONTEXT_SNAPSHOT_CHUNK_COUNT` and `CONTEXT_SNAPSHOT_CHUNK_0` through
   the declared final chunk from `snapshotBindings`. Set the legacy single binding
   to an explicit empty string when switching to chunks. Explicitly empty every
   unused old chunk when reducing chunk count or returning to the single binding:
   removal from Sites settings alone was observed to retain old runtime values.
   Never accept mixed transports. Set secret `CONTEXT_RELEASE_SHA256`, `CONTEXT_SOURCE_MODE=runtime` and the secret approval receipt together, then redeploys the same saved source version.
   Environment edits do not affect the running Site until that deployment succeeds.
   Do not use shell arguments, public assets, Git or a new database to transfer data.
5. The trusted operator must verify hosted owner/anonymous/other-account access,
   synthetic A-to-B digest consistency, old-pin refusal, no payload in logs, and
   native Voice equivalence before setting `CONTEXT_REAL_DATA_ENABLED=approved`.
   The flag is an operational gate, not a substitute for those receipts or a PHI
   review. If a genuinely different account is unavailable, record NOT RUN and
   obtain Steve's explicit scope-specific acceptance of the existing compensating
   controls before release. Unknown setting retention requires content-specific
   acceptance that exact metadata may outlive expiry/deletion. Otherwise keep
   executive content disabled. Only the Site owner may change runtime settings; source permissions stay
   in their original systems. No automated uploader or auto-approval exists.
6. Verify the resulting snapshot/view/digest and expiry through owner-authenticated
   Site reads and Voice. Never count a bypass-token response as visitor acceptance.

This is a manual/on-demand snapshot release channel, **not an unattended sync**.
Existing routines can prepare exports after their review contract is adopted;
automatic publication remains off. Freshness expiry means the Site will show
unavailable until a reviewed refresh is released. Do not claim current data while
presenting an expired snapshot. The platform may retain old setting revisions;
retention/purge behavior needs verification before sensitive executive content.

Rollback first selects `CONTEXT_SOURCE_MODE=synthetic` in the same environment update
that clears `CONTEXT_SNAPSHOT`, `CONTEXT_RELEASE_SHA256`,
`CONTEXT_APPROVAL_RECEIPT` and `CONTEXT_REAL_DATA_ENABLED` and redeploys the
same saved version, returning to the immutable synthetic proof (until its expiry).
Do not rely on deleting settings to select the fallback: hosting did not expose removed
settings in the form assumed by the original code. Preserve owner binding. Do not restore expired/unapproved real content. No source
system is mutated by rollback.

## Tests

`node --test command-center/test/*.test.mjs command-center-proof/context.test.mjs`

Tests use only invented IDs, labels and source responses. Hosted deployment,
real-feed permission, second-account denial and actual Voice acceptance are
separate receipts, not implied by these tests.


## Extended review workspace (September 13 continuation)

The same private Site now has category navigation and a one-item discussion pane.
Global numbers remain stable across filters. Today contains only exceptions;
Projects can include explicitly requested, approved portfolio summaries in the same
snapshot. `read_review_focus` resolves the visually selected item using the same
owner-authenticated pinned API; selecting an item is not an approval or source write.

Preparation defaults remain a 15-minute Today-only proposal. The separate
`--review-hours=2` flag requests up to two hours, bounded by each input feed's expiry;
`--include-portfolio` separately includes quiet `kind:project` records. Neither flag
approves or publishes data. Host Asana/GitHub feeds carry a two-hour snapshot window,
not a claim that source systems are continuously current. The page shows capture and
expiration times. The full payload, including portfolio records not on Today, needs
exact approval. Keep the 100-item and 64-KiB limits; do not shard around them. Hosted
payload capacity beyond the previous small trial has not yet been established.

Expiry controls new API retrieval and visible current context; it cannot remove
previous tool results from a conversation or guarantee platform deletion. Current
answers must use a fresh successful read, not earlier results after expiry. The
owner-authenticated shell and static JS remain available without context; that is
not a healthy-feed signal. Use GET `/api/status`: ready is 200; unavailable is 409
with a fixed non-sensitive reason. Empty shells carry X-Context-State: unavailable.
No raw upstream errors, snapshot bodies or request logs are emitted.

The earlier real trial approval expired. Its receipt must not be renewed, copied to
a different payload, or used to publish this broader review automatically. Prepared
private candidates, Claude reports and coverage records remain outside Git/Sites.
