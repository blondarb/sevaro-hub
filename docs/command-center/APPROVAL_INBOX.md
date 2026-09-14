# Command Center approval inbox

Implementation: PR #40 (`codex/command-center-approval-inbox`), dependent on PR #39.
Published to the existing owner-private Site as v13 on September 14; PRs remain unmerged.
This is an owner-only consent capture feature. It has no external dispatcher.
The existing private Site and Asana/GitHub/Claude ownership model are preserved.

## Steve's workflow

Open **Ready for your approval**, review the exact proposal, and choose **Approve
selected** or **Defer selected**. Approval numbers use A1, A2, etc., distinct from
work-list numbers. Voice can read the same proposal catalog and record a specific
choice after Steve explicitly reviews and authorizes it. Signing in, selecting
an item, silence, source text and read-only refresh permission never mean approval.

A reply shows its sending account, source thread, intended recipient, CC, subject and complete reviewed outbound
text. An Asana proposal shows the authoritative record and exact before/after
values. Attachments, messages with BCC, access changes and code publication are
not supported by this slice. They retain their existing separate approval paths.

Saved consent says **Approved — waiting for delivery**. It does not mean sent,
assigned, updated or completed. Defer records a local choice without changing
Asana or creating a reminder. **Saved choices and withdrawals** permits withdrawal
without requiring the old catalog to be present or unexpired. History is paginated
with **Older saved choices** and a matching cursor for conversational reads. Withdrawal also
does not claim to undo any future external delivery.

## Data and authentication boundary

The Sites gateway authenticates the visitor, and the Worker compares the exact
Site-scoped owner binding. Do not expose the Worker directly or trust these
identity headers on another origin. Signed-out and other-user requests fail
closed. JSON writes require same-origin Origin, a custom request header, no
cross-site Fetch Metadata and an 8 KiB streaming body limit. No CORS is enabled.
Framing is blocked to prevent deceptive overlays: open the private Site directly
for approvals, not inside an editor iframe.

D1 is an operational approval receipt ledger, not a project-state database. Its
append-only application records contain proposal/catalog hashes, source reference
and revision, intended executor, server-derived owner-binding hash, decision,
revision and timestamps. No draft bodies or credentials are written to D1. The
ledger is not a digital signature or tamper-proof audit service. Tool descriptions
instruct the agent to obtain explicit consent; they are not a cryptographic proof
of a spoken user's intent.

The separate reviewed proposal catalog is a protected runtime setting, never
source or a public asset. `APPROVAL_CATALOG` is limited to 4096 UTF-8 bytes for the
platform's per-value limit; the first release is intentionally a small batch.
It requires `APPROVAL_CATALOG_ENABLED=true` and independently pinned
`APPROVAL_CATALOG_SHA256`. Email sender accounts must be explicit addresses; the source message token in
the reply target must match its source link and is shown in the review card.
Delivery must independently verify that account/thread in the provider.
A catalog and every proposal have a maximum two-hour
review window. Approval expires at the catalog's earlier cutoff. New content,
source revision or proposal expiry changes the proposal digest and requires new
consent. Reusing an old approval does not extend its original expiration.

Catalog schema checks are not PHI detection. Actual curated outbound text requires
human/agent review under Steve's exact permitted data scope. No patient data,
raw inbox body, transcript, secret or unreviewed export may enter this feature.
The seven-day metadata refresh grant does **not** authorize real draft catalogs.
Deploy initially with the catalog absent/blank: the UI shows no ready proposals.

## Reliability

One conditional SQLite insert records each revision atomically. Deterministic
event IDs and a unique proposal/revision index prevent duplicate receipts across
retries and concurrent tabs. Conflicting revisions refuse. Batches report each
item separately; partial failure leaves successful receipts available to read.
A lost response is uncertain until readback. No code in this slice calls Asana,
Outlook, Slack, GitHub or an outbound execution queue.

`GET /api/approvals/approved` returns only still-current approved proposals for
review. It is not a delivery token or durable executable outbox. The original
reviewed payload must remain privately available upstream; a future consumer
must authenticate to check current approval/revocation, match all hashes and
source before-state, and refuse expiry or conflicts immediately before writing.
Only authoritative provider receipt plus readback can establish delivery.

## Retained delivery owners and remaining work

- Claude communications keeps Outlook/Apple Mail/Slack context and drafting.
  A verified authenticated delivery-and-readback path is not yet connected.
- The repaired single Asana writer supports approved append-only comments.
  Assignment, stage, priority, dates and other task-field writes are unsupported;
  real catalogs containing those proposals are rejected. Synthetic catalogs may
  demonstrate before/after layouts without enabling any execution.
  Keep writes OFF until the documented old-caller retirement and cutover gates
  are complete. The historical 43 items remain audit-only.
- GitHub merge/publication and account/access changes keep their separate gates.

## Verification and release

Run `node --test command-center-proof/{approvals,context,build}.test.mjs`.
Tests execute generated SQL against real in-memory SQLite, including auth,
CSRF, exact binding, expiry, races, duplicate retries, partial save and readback.
`node command-center-proof/approval-preview.mjs` serves fictional examples at
http://127.0.0.1:3048. Its identity shim is loopback-only; it is not evidence of
hosted authentication. Local receipt data disappears when this preview stops.

Build with the existing isolated build command. The allowlist packages the
Worker/browser modules, logical D1 binding DB and generated Drizzle migrations.
It excludes fixtures, host collectors, private snapshots and credentials.
Hosted acceptance completed September 14 with the generated D1 schema. All four
new WebMCP tools registered and passed fictional success/failure paths. Approval
and defer survived reload; withdrawal worked before and after removing the
proposal catalog. The ledger contains five fictional audit events and zero
outstanding approvals. The production catalog is now explicitly blank/disabled.
Owner access succeeded; unsigned requests with forged owner headers were denied.
A second signed-in account and a new native Voice session were not tested.
The private publication receipt records exact source/version/deployment evidence.

September 14 acceptance: 22 focused tests passed, including generated SQLite
migrations and the isolated packaged Worker. Independent safety review found no
remaining material findings after targeted fixes. In the Codex in-app browser,
all four new WebMCP tools registered and passed representative success and
failure checks against fictional local proposals: read inbox, read history,
record approve/defer and withdraw. Saved choices matched the visible cards;
unknown catalog/receipt and malformed read inputs rejected. This is local
WebMCP contract evidence, not hosted D1 or a new live Voice acceptance result.

For later code publications, after separate publication authorization: deploy only to the
existing owner-private Site; keep the catalog empty; verify owner/non-owner
request rejection, same-origin writes through Sites, migrations, readback and
WebMCP using only fictional proposals. Confirm the shared context refresh grant
is correctly pinned to the saved source version before resuming that path.
A local test does not establish hosted D1/session behavior or native Voice
acceptance. Preserve the prior v12 release and its receipt for an explicitly controlled rollback;
routine maintenance must reuse v13 to retain the approval section.
Disable new catalog capture for rollback; keep receipt history and withdrawal
available. Do not drop the ledger. Reverting completely to v12 temporarily removes
withdrawal UI, so do so only with capture/dispatch disabled and preserved receipts.

## Backlog: more automation, deliberately not enabled

Steve requested keeping broader automation as a future option. First connect
one exact approved reply and one supported Asana comment through their retained
owners with provider readback, revocation and uncertainty handling. Then consider
bounded standing permissions for specific low-impact operations. Keep access,
code publication, assignments/stages and consequential messages separately gated.
Reuse existing routines; do not add another daily summary or scheduler.
