# Existing Claude routines → private Command Center

This is an export step for existing work, not a new intake agent, schedule, dashboard
or status authority. Steve approved this integration phase on September 13. The
current Site release and its expiry remain separately approved; this step cannot
publish or renew it. The implementation lives in sevaro-hub.

## What the existing routine does

At the end of an actual run, Claude may export only already-reviewed executive
project findings from that run's authorized inputs. Preserve the existing Outlook,
Fyxer, Slack and document access boundaries. Do not broaden a Sent Items routine
into inbox access. Do not run legacy Asana writers to obtain an export. The existing
single-writer hold takes precedence over old auto-write instructions.

Claude Code continues to own `data.js`; Cowork continues to own `index.html`.
Neither is imported or rewritten by the Hub. Do not substitute their modification
times for evidence observation times. A schedule definition is not a run receipt.

Use the existing private directory `~/ClaudeSync/handoffs/command-center/`.
Write one fixed file per actual feed, with private directory/file modes 0700/0600:

| Existing owner output | File | source_id |
| --- | --- | --- |
| Labs coordination, reviewed decisions/commitments/blockers | claude-coordination.json | claude:coordination |
| Existing approved reply triage, references to drafts only | claude-replies.json | claude:replies |
| Existing calendar/meeting preparation | claude-calendar.json | claude:calendar |
| Completed bounded local module-review export | claude-module-review.json | claude:module-review |

The module-review feed is not evidence of email, calendar, Riya's Claude, or Dhruv's
latest unpublished results. Do not mark the other feeds available because it exists.
If authorized input access is unavailable, record unavailable; never manufacture a
successful empty sweep. Re-exporting old evidence preserves its observation and
expiry; it does not make it fresh.

## Exact packet

Top-level keys: `schema_version:2`, `feed`, `review`, `run`.

`feed` is the exact existing normalized feed schema in `command-center/README.md`.
It has source ID/system, observed_at/expires_at, available/partial/unavailable status,
fixed failure code and curated items. No raw message bodies, subjects, transcripts,
patient information, personnel/compensation details, source prompts, credentials,
arbitrary attachments or unrestricted source URLs. Review every free-text field and
link. Use the authoritative link for the actual finding. An Asana initiative link is
appropriate for initiative findings; it must not replace the actual calendar event
or communication link merely to satisfy the allowlist. Withhold an item whose
source cannot be attributed and record the coverage gap without inventing a link.

`review` has exactly:

- `reviewed_by`: `Claude`
- `reviewed_at`: actual UTC review completion time
- `policy`: `executive-project-context-v1`
- `feed_digest`: SHA-256 of canonical JSON for the exact feed, using the exported
  `sha256` helper in `command-center/context.mjs`
- `packet_digest`: SHA-256 of canonical `{feed,run}` using that same helper

Claude records the review only after actually checking the content. The checksum
is integrity evidence, not a PHI detector, a signature or Steve's approval.
`packet_digest` binds the outcome, coverage and run times that determine whether the
feed is partial or complete. Legacy schema-version-1 envelopes lack this binding and
are held as unimportable until Claude re-reviews and emits a version-2 envelope.

`run` has exactly:

- `run_id`: stable identifier for this actual run (same ID on a retry)
- `routine`: existing routine's stable name
- `started_at`, `completed_at`: actual UTC times
- `outcome`: `succeeded`, `partial` or `failed`
- `coverage`: `complete-allowlist`, `reviewed-sources-only` or `unavailable`

A succeeded run uses complete-allowlist coverage, a partial run uses reviewed-sources-only,
and a failed run uses unavailable. A failed run cannot claim an available feed.
Completeness refers only to the exact configured source scope, never all of Claude's
work. Do not relabel a partial run to make it importable.

Evidence must have been observed no later than run completion, which must precede
review completion. A later export/review run may review older evidence; its observation
time may precede that run's start and must retain its original expiry. This is a
review/assembly receipt, not a claim that the export run re-observed the sources.

Partial packets import as the closed `partial` source state. Their reviewed items may
appear while fresh, but the snapshot health and private Site state remain explicitly
partial; they never become `available` or complete coverage. Expired partial feeds
become stale and contribute no items. Failed or unavailable feeds contribute no items.
This keeps a bounded module review useful without presenting it as a complete Cowork
feed or adding a duplicate DONE follow-up beside the existing Asana decision before
reconciliation.

For `claude:replies` only, the effective snapshot expiry is the earlier of the
reviewed producer expiry and two hours after the original `observed_at`. This derived
cap is applied only after the envelope digest is verified; it does not modify the
original packet or receipt. The CLI reports both `source_expires_at` and
`effective_expires_at`, and freshness uses the effective value.

## Validate and prepare — no external writes

Use the verified Hub checkout until the feature branch is merged; do not assume
`~/dev/repos/sevaro-hub` has the new commands. The active candidate path is recorded
in the shared coordination handoff. With that checkout as the working directory:

```sh
node command-center/claude-export-cli.mjs "$HOME/ClaudeSync/handoffs/command-center/claude-coordination.json"
node command-center/refresh-cli.mjs "$HOME/ClaudeSync/handoffs/command-center/refresh-plan.json" --include-portfolio --review-hours=2
```

Only invoke the second command after validation passes with importable=true. Its
`source_state` may be `partial`, which must remain visible in the prepared health
receipt and review context. Check `fresh` / `usable_for_snapshot`: validation preserves
the feed's original observation and expiry and does not make expired evidence usable.
It performs allowlisted Asana/GitHub reads and
imports reviewed local feeds. It never contacts Outlook or Slack itself, approves a
snapshot, publishes to Sites, changes Asana, sends replies or creates a schedule.

`refresh-plan.json` is private configuration, not project state. It names exact
source targets, approved labels, allowed hosts and private exports. A new target,
new text or broader source scope requires review. Do not put this plan in Git.

A successful unchanged run prints nothing. Changed findings or failure transitions
produce fixed metadata only for the existing routine's exception handling. There is
no extra digest/notification. A nonzero exit is a preparation failure; read the
fixed error/health code, do not include raw upstream errors in any message.

## Recovery and approval

The preparer maintains current/prior pending candidates and `refresh-health.json`.
It keeps the previous candidate intact on failed collection or replacement and
retains last success/failure evidence. Missing feeds remain explicitly unavailable.
An exclusive lock prevents concurrent rotations; `refresh_locked` requires checking
whether the owner process finished before removing a stale lock. Do not delete a
lock blindly or treat a configured job as a completed run.

Prepared output is always `executive-pending-review`. It cannot replace the live
Site without a new exact-content approval and expiry-bound receipt. The current
35-item release is not standing approval for new free text, new feeds, or renewal.
A future standing metadata refresh policy must explicitly define source/field scope,
duration and retained access/retention limitations; it does not exist yet.
