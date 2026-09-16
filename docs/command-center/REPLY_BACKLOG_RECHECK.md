# Source-verified historical communications references

## September 16 current recurring scope and acceptance hold

The retained `Comms afternoon check` trigger
`trig_014A4RTxbJ3ksWRxgs15wEMp` was still running an older 30-day Inbox/Sent/Slack
sweep prompt. Its September 15 afternoon run declined that scope. The live prompt
has now been narrowed and read back in the native schedule editor: only the three
previously verified nonclinical reply threads, original-source identities,
metadata-only retrieval, no broad mailbox/Slack discovery, and no source writes.
The existing weekday 14:00 Mountain schedule and September 21 09:27:52 Mountain
cutoff were preserved. This supersedes the broad-sweep language in older notes.

The manual acceptance run delivered an immutable Drive packet, but host content
review held it despite valid schema and hashes. It inferred that a colleague's
reply removed Steve's obligation, asserted complete coverage from limited queries,
and did not establish original-thread-only retrieval or the source chronology.
The schedule is **paused** pending a corrected, source-supported acceptance; a
saved prompt and a producer's “completed cleanly” statement are not acceptance.
The original packet remains private audit evidence and was not imported or
published. Existing historical items remain unchanged. The producer was asked to
correct only from already obtained evidence, without additional mailbox reads.

Before resuming the same trigger, verify the corrected content and actual read
scope against the retained producer run. Another person's reply is thread
activity, not automatic delegation or clearance. An empty search cannot refresh
an old obligation as current. If original-source support or safe retrieval is
unavailable, publish only truthful unavailable/partial coverage through the
existing review path; do not add a fallback broad search. Keep every original
source observation time, use an actual later review time, and preserve older
records rather than silently resolving them. No new routine is needed.

## September 15 source-attribution repair

Both earlier nine- and eleven-reference plans are quarantined. They inherited an
archived packet with communication claims linked to an Asana initiative, which
could not substantiate those claims. Format validation and matching hashes did
not verify attribution. Do not migrate those plans or use their counts as open work.
The originals remain private audit evidence; no historical obligation is silently
closed or rewritten.

`reviewedClaudeExport` now rejects `claude:replies` items unless the source URL is
an exact allowed Outlook message route or an allowed work Slack message permalink.
Related Asana initiatives and calendar event links are not communications evidence.
This structural check does **not** prove a message exists or supports a claim.

## Trusted host verification

`prepareReplyRecheck(packets, {allowedHosts, now, prior, verifySourceReference})`
requires a trusted-code callback for **every** final reference, including references
retained from a prior plan. Each challenge binds the packet digest, full original
item digest, item ID, original communication URL, source revision and observation
window. The callback must match these exact fields to independent reviewed source
readback or an authenticated retained-producer receipt with inspected item content.
It must return true only for an established match. Never implement it as
`()=>true`, derive a trusted list from incoming data, or authenticate source claims
using a filename, hash, `reviewed_by`, or JSON flag. Record actual verification
method and limits separately in the existing private handoff, outside Git.

Plans use schema version 2 and carry each original item digest. Legacy version 1
plans are rejected; there is no automatic migration. Re-signed prior plans do not
bypass callback verification. Original packet/run/time consistency, max100 bounds,
exact replay, and omission-preserves-history behavior remain. No new observation,
expiry, task closure, priority or owner is inferred from rebuilding a plan.

The standalone `reply-recheck-cli.mjs` has **no authenticated verification channel**.
It refuses nonempty inputs with `independent_source_verification_required`; a local
manifest cannot enable it. It can still validate/write empty preparation results.
Nonempty rebuilds are performed by the existing trusted host only after actual
verification. The portable refresh CLI remains closed to unauthenticated Claude
origin. This change does not add a cloud connector or permit unattended delivery.

## Rebuilding and remaining coverage

Rebuild from independently checked records only, without either quarantined plan
as prior input. The two September15 Outlook items from the authenticated retained
Claude V2 export are eligible for a bounded host review. They do not validate any
older claim. Retained-producer readback is not an independent Codex mailbox read,
clinical validation, or a fresh provider check. Keep the packet's observation and
two-hour expiry. Expired records are historical handles only, never current work.

Older work still requires the existing Claude owner to reconcile independently
supported original-thread evidence under the current narrow scope above. The
earlier 30-day/100-thread recurring scope is superseded; this document does not
authorize a mailbox or Slack discovery sweep. No direct Codex Slack access or
patient-containing briefing read. Record inaccessible references and partial coverage; do not infer
unanswered status from unread flags or omission. Publish only freshly reviewed
executive metadata through the existing grant. Sending, provider drafts, Asana
writes, recurrence and access changes remain disabled during the provenance hold.

## Checks

Tests cover valid communication links, initiative/calendar rejection even with
correct hashes, missing/negative verifier, exact item-content binding, retained
prior verification, legacy rejection, stale/empty/failed runs, conflicts, bounded
history, private file handling, and the standalone CLI's inability to self-approve.
