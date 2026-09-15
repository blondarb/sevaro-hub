# Existing Claude routines → private Command Center

This is an export step for existing work, not a new intake agent, schedule, dashboard
or status authority. Steve approved this integration phase on September 13. The
current Site release and its expiry remain separately approved; this step cannot
publish or renew it. The implementation lives in sevaro-hub.

### September 15 cloud acceptance result

The manual migrated afternoon run completed ordinary communications collection but
**refused the structured export**: it treated approval statements added to the saved
prompt as untrusted. No cloud export was delivered. A capability-only follow-up
explicitly prohibited retrying the transfer or reading more sources. Claude reports
its Drive `create_file` can create raw JSON in a specified parent; `update_file`
changes metadata only, so a fixed-file overwrite transport is not supported by
those declarations. No Drive write was tested.

Claude suggested Steve edit the task prompt himself, then acknowledged that it
cannot distinguish that persisted text from the rejected instructions. Treat this
as an unresolved direct-consent boundary, not a verified approval API or successful
cloud integration. Do not rephrase the export instructions, claim Steve's consent
again, or switch transfer tools to bypass the refusal. The owner must resolve it
in the retained task before an immutable-file delivery design is accepted.

### September 14 evening: current producer and cloud acceptance

The retained afternoon routine successfully re-read its connected work Outlook
and Slack sources. The fresh reply packet exposed three separate contract issues:
invalid native IDs (producer repaired and preserved the rejected packet for audit),
documented Outlook message links (receiver support added), and two status labels
longer than 100 characters (requires faithful shortening and actual Claude
re-review). Never truncate or rewrite a reviewed packet inside the receiver.

The existing afternoon routine was moved with Cowork's native **Move to cloud**.
The platform paused the local copy; its replacement retains weekdays at 14:00
Mountain with **Require this computer** off. One manual cloud acceptance run was
started. This is configuration evidence, not proof of successful unattended
collection or delivery. The morning routine remains local at 07:00; the existing
weekday meeting routine still requires the computer. Do not migrate additional
routines until the first cloud output and transport are verified.

The existing ClaudeSync directory is already backed by the owner's private Google
Drive. The command-center incoming folder and its existing JSON meeting file have
one owner and no additional shares. Native Drive retrieval can obtain that file
without desktop interaction. This proves a read route, not Claude cloud's ability
to replace raw JSON or a scheduled Hub consumer. Exact folder/file IDs and run
receipts remain in the private handoff. Do not create another folder or schedule,
broaden access, or treat self-declared packet hashes as authenticated origin.

### Morning acceptance finding — September 14

The retained 04:00 communications run produced a valid packet observed at 10:05Z,
expiring at 12:05Z, before the Labs 07:30 Mountain consumer. A fresh manual reply
check reached the V2 validator; its actual Slack source exposed the missing
permalink support repaired in this branch. Immediate producer delivery addresses
transport delay but does not make 04:00 evidence current at 07:30. Align the
existing morning cadence with Steve's review time before calling this unattended
morning readiness. Do not add a second digest, extend source freshness, or describe
an empty partial check as a clear inbox. Cadence is unchanged by this PR.

The current calendar and separate meeting producers can emit the same event ID.
The assembler still refuses collisions; withheld duplicates are a coverage gap,
not an empty calendar. Establish one owner per event-preparation obligation before
combining overlapping feeds. This patch does not select a conflicting source.

### September 14 continuation: producer work still required

- The module review now has an actual bounded local Claude re-review and a
  mechanically bound V2 receipt. Its item distinguishes local source implementation
  from still-unverified published Riya/Dhruv results and measurement reliability.
  It is partial coverage, not a live communications or clinical validation feed.
- Native Claude schedule control reached a locked Mac. No cadence or calendar
  ownership change was applied. Resume the existing owners after unlock; do not
  create a replacement task, bypass an approval denial, or relabel stale files.
- Morning cadence repair should put the retained communications run close enough
  before the existing 07:30 Labs consumer for its two-hour reply evidence window
  to remain valid. Confirm the UI timezone and actual next-run time when editing
  the existing task; the contradictory old description is not configuration.
- Calendar and meeting producers must reconcile the same event-preparation
  obligation explicitly. Retain the known event IDs and both reviewed source
  records while unresolved. Separate follow-up commitments only when they are
  actually distinct obligations; renaming duplicate IDs is not reconciliation.
- A successful interactive run does not establish unattended operation. Close
  delivery only with the next clock-triggered producer receipt, matching importer
  digest and fresh candidate. Report default-calendar-only or partial reply
  coverage accurately. Keep the already-paused duplicate briefs paused.

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
link. `claude:replies` now structurally requires an original Outlook message link
or permitted Slack message permalink; initiative and calendar substitutions fail.
This route check does not verify the content: the trusted consumer must match the
exact record against authenticated producer/source evidence before using it. Use the authoritative link for the actual finding. An Asana initiative link is
appropriate for initiative findings; it must not replace the actual calendar event
or communication link merely to satisfy the allowlist. Withhold an item whose
source cannot be attributed and record the coverage gap without inventing a link.

Reviewed Slack items use the observed `https://sevarohealth.slack.com/archives/`
message permalink, with no query or fragment. Other workspaces, API endpoints,
redirects and credentials are refused. This permits source navigation only;
Codex does not acquire direct Slack access. The same validator is bundled into
the Site, so new link support must be deployed before publishing such a snapshot.

Microsoft Graph's documented message `webLink` is also accepted at the exact
`https://outlook.office365.com/owa/` route with exactly `ItemID`, `exvsurl=1`,
and `viewmodel=ReadMessageItem`. `ItemID` is case-sensitive. The calendar route
continues to use lowercase `itemid` and `path=/calendar/item`. No compose route,
extra parameters, return URLs, fragments, embedded credentials or tokens are
allowed. Keep the provider's observed URL unchanged. See Microsoft's
[get-message example](https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0).

Normalized `item_id`, `source_id`, `run_id` and `routine` identifiers must match
`^[a-zA-Z0-9:_./-]{1,160}$`. Do not copy native Outlook IDs containing `=` or append
`#prep`. For meeting items, use `claude:meeting:` plus the full SHA256 hex digest
of the exact native event ID; use the same deterministic mapping on every run.
Preserve the original authoritative event URL separately. Fixing an identifier
requires a new content review and recomputed hashes, not changed source observation
times or automatic publication approval.

For replies, derive a deterministic identity from the original source identity
plus the distinct action identity, not the title: `claude:replies:` followed by
the full SHA256 hex digest of their canonical JSON array. Preserve a previously
accepted valid mapping and explicitly reconcile historical mappings; changing
an ID is not a way to remove a duplicate obligation.

Before final review and hashing, assert all field limits from the shared schema:
`spoken_name` 80, `status` 100, `context` 600, `recommendation` 400, and
`next_event` 240 characters. `source_revision` is a label up to 100 characters,
not one of the restricted identifiers. A formatting correction must preserve
facts and uncertainty, receive an actual new content review, and recompute both
hashes. Keep original observation, expiry and run timing. Record only the actual
new review time; reviewing an old packet does not refresh its sources.

For the retained weekday meeting routine, prefer its already connected, verified
Microsoft 365 work-calendar read over Mac Calendar AppleScript. Read the next
48 hours once with bounded scheduling metadata, then review only actionable
executive/project preparation. Do not fetch bodies/transcripts, retry failing
calendar indexes, substitute personal calendars for work coverage, or imply
shared/delegated calendars were checked when only the default calendar was read.
Use verified scheduling facts only: calendar invitation descriptions do not establish
current project stage or milestone progress. Omit attendee names/counts and old
invitation-change history. Use ISO dates/times, or compute a weekday from the date
instead of generating one independently. Asana continues to supply project state.

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

Partial producer packets may declare `feed.status: partial` directly; legacy partial receipts with `feed.status: available` are still normalized to partial. A succeeded receipt cannot certify a partial producer feed.

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

Prepared output is always `executive-pending-review`. Publication requires either
Steve's exact-content approval or an active, explicitly approved refresh scope,
an actual content review and a distinct digest/expiry-bound derivation receipt.
Steve renewed the scope for seven days on September 14; it ends September 21 at
09:27:52 Mountain. Preserve the old morning grant as history.
Site v12 validates the original authorization and its independently pinned
destination/version anchor. Do not represent a Codex review as a new Steve approval.
See [the authorization operating contract](AUTHORIZATION_OPERATING_CONTRACT.md)
for the current boundary and the proposed simpler renewal process.


## September 13 communications recovery

The existing Cowork morning session produced a current reviewed reply envelope in
its own session outputs directory, without another folder grant. Codex validated
its hashes, source times and coverage, preserved the prior shared export, and
imported the corrected packet into the existing private handoff. The one item that
said no reply was owed was removed by Claude and the packet re-reviewed before
import. The result is zero reviewed reply obligations with **partial** coverage;
it does not establish a clear inbox. Source observation is September 14 00:54:10 UTC,
expiry 02:54:10 UTC. This is time-limited evidence, not continuous freshness.

A fresh failed/unavailable packet is importable health evidence but is never
`usable_for_snapshot`. Both this case and explicit partial producer packets now
have synthetic regression checks; 23 affected export/refresh checks pass.

The actual existing morning and afternoon schedule prompts now include a quiet
read-only export override and inline v2 contract for folderless sessions. Original
gathering instructions remain as reference; the override takes precedence over
legacy self-email, Apple Notes, Drive digests and external draft creation. Source
scope is executive/project-only; failed/empty sent checks remain incomplete.
Schedules, connections and the paused duplicate tasks are unchanged. UI readback
and the corresponding local Scheduled files confirm persistence. The next timed
execution has not been observed.

At that earlier receipt, session output delivery was a one-time transfer. The
subsequent account/workspace-bound importer now discovers retained local session
outputs during the existing locked refresh. The meeting producer has also passed
one actual cloud-to-Mac fixed-path staging run. These manual receipts do not prove
the next timed run, unattended tool permissions, or continuous Site refresh. No new
schedule or Site publication was added by the delivery repair.

## Automatic host import and explicit obligation links

See [reviewed obligation reconciliation and Cowork delivery](OBLIGATION_RECONCILIATION.md) for the account-bound importer, the existing Labs refresh hook, and the cloud meeting delivery limitation. The actual weekday meeting digest now emits `claude-meetings.json` as a separate source. Its September 13 reviewed cloud artifact passed the fixed-path Mac staging and locked importer acceptance. The existing Microsoft 365 work-calendar read succeeded; the next scheduled producer run and unattended delivery remain unverified.


## Overnight producer receipt correction

A genuine communications recheck initially emitted an observation time later than
its own completion/review time. The importer must reject that packet. Claude
corrected its receipt using the recorded source-read time, preserved the rejected
artifact under a distinct audit filename, and recomputed the review digests; the
corrected export validated and imported through the existing bound session path.
The retained morning and afternoon instruction sets now require parsed timestamp
ordering and canonical-digest assertions before emitting the named output. A
producer assertion is defense in depth; the host remains the enforcement boundary.

The 04:00 morning task previously expired before Labs at 07:30. On September 14,
the existing Comms morning briefing was saved at 07:00 local/Mountain; the UI
confirmed the next run tomorrow at approximately 07:00. Frequency, instructions,
model and access were preserved. A future scheduled run/delivery is not yet verified;
never extend source timestamps/expiry to hide missed delivery.

The bounded 15:05 UTC rechecks returned fresh partial replies and coordination.
Cowork reported Outlook disconnected, and incomplete sent-message coverage remains
partial. Steve requested Apple Mail evaluation: the retained communications owner
verified the work Inbox/Sent Items through existing app scripting and found recent
Inbox timestamps in a bounded ten-message sample. This does not establish complete
Sent coverage or synchronization. Work-account-only fallback instructions are now
saved in both retained communications routines; no personal-account ingestion,
new scheduler or actual Mail obligation export has been accepted.

For derived runtime updates, explicitly set `CONTEXT_APPROVAL_RECEIPT` to an empty
string while retaining the required `CONTEXT_REFRESH_GRANT` and receipt. On the
hosted v12 acceptance, removing the legacy key alone yielded 409; explicit blanking
restored authenticated reads. Retained provider configuration is suspected, not
confirmed. Blank unused payload transport keys when changing modes; never mix
legacy approval with derived approval or relax the runtime checks.
