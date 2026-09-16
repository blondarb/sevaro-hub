# Reviewed collection without desktop login

The Site publisher and Asana/GitHub collector already work while the Mac is
locked. Claude Desktop control does not. Do not solve this by disabling the
screen lock, FileVault, authentication, or approval protections.

The installed Claude subscription CLI discovered connected Microsoft 365,
Fyxer and Drive connectors on September 15. A bounded live test authenticated
the expected work mailbox and returned one of three named work meetings while
desktop control was blocked by the lock. The two empty searches did not prove
those other meetings were cancelled. This proves locked-screen source access;
it does not prove Mac-off availability or complete calendar coverage.

The guarded canary completed September15 at16:17:24UTC: host hooks verified the work account, enforced one exact query, and retained one source-backed calendar metadata row in a0600 private review artifact. Seventeen focused synthetic checks cover scope, identity, replay, malformed envelopes and evidence completeness. Email CLI transport also worked, but the new guarded email lane and semantic reply reconciliation have not had live acceptance. No result was imported or published.

## Existing owner, explicit review

`command-center/claude-read-cli.mjs` is a helper for the existing refresh owner,
not another scheduler or standing agent. It calls Claude using existing
subscription authentication, no shell, no local-file tools, and only profile,
scope and the chosen Microsoft 365 metadata search tools. `dontAsk` denies
unapproved tools; it is not bypass-permissions mode and changes no saved policy.
The helper does not invoke body/resource readers, fetch attachments or invoke Fyxer/Slack. Microsoft 365 email search can itself return preview text to Claude; it is not a guaranteed metadata-only input interface. The host discards previews and model prose, and this helper must not be used for broad mailbox discovery.
Narrow pre-reviewed nonclinical queries remain essential: metadata can itself
contain sensitive information, and this wrapper is not a PHI classifier.

Put the request in the existing owner-private Command Center folder, outside
Git, mode0600. It must contain exactly:

```json
{"schema_version":1,"lane":"calendar","expected_mailbox":"owner@example.com","queries":["Synthetic project review"],"after":"2026-09-15T10:00:00Z","before":"2026-09-16T10:00:00Z"}
```

The email lane uses `outlook_email_search`; calendar uses
`outlook_calendar_search`. Maximum four unique specific queries, five results
per query enforced before invocation, a maximum 48-hour window, and a 180-second process
timeout. No wildcard queries. Requests remain trusted operator configuration,
never sourced from an incoming email or packet.

```text
node command-center/claude-read-cli.mjs PRIVATE_REQUEST_PATH claude-read-UNIQUE-RUN.json
```

There is one exclusive lock per lane. An existing output path prevents repeat
execution of the same logical run. A crashed lock or incomplete reserved output
requires the owner to inspect the stopped process before recovery; do not delete
locks or retry uncertain runs blindly. Failed/denied/incomplete responses are
held. Raw stderr is not logged or shown.

Per-run Claude hooks enforce the exact query, time range and count before each source call. Searches require a matching mail and UPN from the actual get_me tool response. Other-mailbox overrides, pagination, changed queries, retries, raw resource reads and writes are blocked. Per-run audit updates are serialized so parallel calls cannot reserve the same query twice. Missing hooks, unknown response formats, incomplete calls or any denial hold the run. Hooks neither authorize source access nor replace subscription authentication.

The final artifact contains only host-observed allowlisted source metadata and response digests. Model prose and claimed approval are discarded. Audit files omit bodies, previews, transcripts and profile contents. Requests and hook settings are private, outside Git.

Every successful output is **review_required**, never an accepted Claude feed.
Tool evidence establishes which bounded read returned the metadata; it does not establish a reply obligation, urgency or clinical validity. The existing owner must check the actual source evidence, mailbox,
links, observation times and semantic support before constructing a reviewed
V2 export. Empty searches never close older obligations. Do not fabricate a
portable origin verifier or make a model's approved flag an admission decision.
Existing source-verification, stage/import and exact Site release binding remain.

## Cutover and remaining dependencies

- Keep one existing refresh owner. Invoke this helper only for a scoped recovery
  or approved run that is not duplicating an active Cowork producer. Do not add a
  second launchd/cron/cloud schedule.
- Current morning/afternoon Cowork routines remain the normal communications
  owners. Their schedules are not controlled by the Claude Code CLI.
- Fyxer action-item scoping and the historical leadership-prep feed remain
  separate gaps. This helper does not bypass either or duplicate their items.
- A locked, awake, network-connected Mac can execute CLI calls. A sleeping,
  powered-off or disconnected Mac cannot be assumed available. An always-on host
  or fully cloud producer/consumer is still needed for that stronger guarantee.
- Do not move credentials or change host access as part of this helper. Prove two
  actual scheduled end-to-end cycles before calling delivery unattended. Reuse
  existing private grant expiry and keep source writes disabled.

References: [Claude CLI hook enforcement](https://code.claude.com/docs/en/hooks), [Claude Cowork cloud and desktop dependencies](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile).
