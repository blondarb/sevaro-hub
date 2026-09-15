# Retaining unresolved attention

Feed expiry answers “when was this checked?” It does not answer “has Steve
addressed this?” An expired feed or omitted row must not erase a previously
reviewed obligation.

## Storage and authority

`retained-attention.json` lives in the existing private Command Center handoff
root, outside Git and outside public Site assets. The directory must be owner-only
and the file mode 0600. Writes are atomic and share the refresh lock. The store
contains only already-reviewed executive metadata, original links/revisions,
publication evidence and local attention dispositions. It contains no message
bodies, transcripts, patient data or credentials. Hashes detect accidental changes;
they do not authenticate a producer or establish semantic source truth.

Asana and the original communication remain authoritative. A local dismissal means
“remove this from Steve's attention,” not “complete the Asana task” or “send a reply.”
Claude keeps the existing Outlook/meeting ingestion; Codex maintains this read
projection; ChatGPT discusses the same immutable snapshot used by the page.

## Admission after publication

After each authorized release, the retained host operator must:

1. Verify the exact deployment succeeded for the existing private Site and saved
   version. Read the exact snapshot through the owner-authenticated read tool and
   compare its snapshot/view/digest with the reviewed release.
2. Call `retainPublishedReview` from `command-center/retain-publication.mjs`
   with the exact expected project/version, snapshot and publication. Its trusted
   `readDeployment` and `readPublishedContext` callbacks use the existing
   authenticated operator readers (or their just-witnessed exact results). The hook
   checks deployment success and exact readback before calling the locked
   `updateRetainedAttention` and `rememberPublication` operations. A packet flag, a matching checksum, or an approval draft
   alone is insufficient. Never use an unconditional callback in an unattended
   importer. The API is a host boundary, not an automatic publication verifier.
3. Save the returned digest/count in the existing private publication receipt.
   If admission fails, report retention failure separately from publication
   success. Re-run the exact admission safely; it is idempotent.

Only published Today items seed retention. Pending current/prior snapshots, old
quarantined plans and arbitrary archived exports never seed it. Re-publishing old
history does not renew its source observation or admit it as new evidence.

## Refresh and review

`refreshOnce` reads the store while holding its existing lock. Fresh source rows
with the same item ID supersede historical rows. Missing active rows remain in the
candidate with `historical-needs-recheck` metadata, original observation and link,
and `action_state: none`. Source health stays stale/unavailable/partial as observed.
The page labels the previous status and recommendation as historical; its context
and item-resolution APIs return that same row. Numbers are stable within the
immutable snapshot, including filtered views; use the stable item ID across releases.

Exact live Asana completion and excluded-assignee reads produce dispositions.
Omission, an empty export, an elapsed meeting time, free-text status and a failed
read are never completion evidence. Removed sources/targets are not carried.
Permission failures and source conflicts persist a withholding disposition; a
later generic outage cannot re-expose that cached history. Newer independently
reviewed publication evidence is required to restore withheld history.

Owner dismissal uses `disposeAttention` with the exact item ID, current saved-item
digest, decision time and evidence identifier, and a trusted callback verifying
Steve's instruction. No page dismissal control is added in this change; the host
operator records an exact instruction from the conversation. Disposition receipts
remain with inactive records; unchanged replay does not undo them. A newer source
observation with a changed authoritative revision may be proposed as reopened work
and retained again only after verified publication. Preserve the original owner or
source-read receipt separately when admitting reopened work. There is no automatic
purge or silent truncation: the current 100-entry/128-kB storage and 100-item
snapshot limits fail visibly at capacity, requiring an explicit archive policy.

## Cutover and limits

Merge the reviewed feature PR, install the same host code, then publish the matching
Site code supporting snapshot schema 2. Seed only the verified published review,
prepare a new pending snapshot, review every retained field/link, and use the
existing publication authorization path. Finally verify the deployed page and
read/resolve tools across a deliberately stale synthetic feed. Rollback preserves
the private store and selects the previous Site version with a compatible snapshot.
Do not send schema 2 to an older Site validator.

Retention does **not** extend authentication, the exact-content approval, the
per-snapshot review window, or the standing refresh grant. The host retains items
through these expirations, but the Site still needs an authorized reviewed refresh
to display them. Continuous availability therefore also requires reliable existing
refresh delivery; this change alone does not establish unattended operation.
No new schedule, source-system write path, access grant or source-upload approval
is introduced.
