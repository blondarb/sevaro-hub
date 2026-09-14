# Host-only delivery handoff

`command-center/delivery-handoff.mjs` is a small host-only binding layer for the
existing Claude communications owner and the existing Asana comment writer. It
does not authenticate to a provider, dispatch a message, invoke a writer, stage
an approval, create a catalog, or mint an approval grant.

Every operation receives `catalog_env` for `loadApprovalCatalog`, one exact
approved receipt, the selected proposal, and a current provider/source preflight.
The catalog and proposal remain subject to the existing two-hour maximum review
window. Any expired, conflicting, changed, or missing binding fails closed.

For a reply, `prepareReplyEnvelope(input, {root, now})` requires the current
sender account, thread, draft revision and provider source revision to exactly
match the approved proposal. `root` must be an existing caller-supplied,
non-repository, owner-only 0700 directory; symlinks and missing roots reject
without creating directories. It fsyncs a private temporary file then uses a
no-overwrite hard link to publish the deterministic 0600 envelope. Its full
reviewed payload never appears in returned metadata or stdout. A refreshed
observation timestamp does not change the operation; conflicting contents refuse.

`issueReplyDispatchPermit({envelope_path, dispatch_start}, {now})` accepts the
actual Site `dispatch_started` receipt, including its attempt, catalog,
approval-revision, executor, source-revision and lease bindings. Permit expiry is
the earlier Site lease, original approval, and source-preflight expiry; a helper
cannot renew a prior permit. It records `authentication_established: false`: it
cannot establish or infer provider authentication.

The protected envelope retains the complete validated proposal plus its source
URL, executor, and SHA-256 destination digest. Before issuing a permit, the helper
recomputes that digest from the stored payload and requires it to match both the
envelope and the Site receipt. Envelope reads use a no-follow descriptor and
same-descriptor stat under the verified private parent; edited recipient, sender,
or message fields fail closed.

`recordReplyOutcome` accepts only a tightly constrained provider identifier and a
readback SHA-256 digest. It saves no raw provider response or message body.
`unknown` has null provider/readback fields and is `manual-review-required`.
Later authoritative readback may append a `delivered` outcome after permit
expiry; it does not replace prior audit evidence. Identical outcome retries are
idempotent. A dispatch receipt is retained privately and binds the outcome permit
to its original attempt. One fixed terminal path rejects a different successful
provider/readback result; an `unknown` result cannot be appended after terminal
delivery.

For Asana, `mapApprovedAsanaComment(input, now)` is pure. It accepts exactly one
approved append-only comment into the exact `asana_sync.py validate_plan`
operation shape: `target`, `text`, `target_snapshot`, `source_ids`,
`content_reviewed`, and `evidence`. The target snapshot and every source ID are
SHA-256 strings; evidence is the writer's reviewed string list. Values pass
through unchanged, so this helper never invents historical queue identifiers.
No writer is called here.

Run `node --test command-center/test/delivery-handoff.test.mjs`. These synthetic
tests cover idempotency, expiry, exact source binding, protected paths, Site
receipt leases, outcome revisions, and Asana target/revision mismatches. They do
not prove provider authentication, delivery, writer behavior, or production
readback. No consumer is authenticated or wired to execute these handoffs, and
no live delivery is claimed.
