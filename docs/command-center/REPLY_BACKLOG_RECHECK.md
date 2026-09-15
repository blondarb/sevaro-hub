# Reconcile older communications through the existing Claude owner

The recent communications window is not inbox coverage. An item omitted from the
next export may have been missed, moved outside the window, answered, delegated,
or closed. The Hub must not choose among those explanations.

## Offline preparation

`command-center/reply-recheck-cli.mjs` produces a private, reference-only worklist
from explicitly selected reviewed V2 reply packets. Include the prior worklist on
later preparations so rotation of current/previous exports does not lose handles.
The operator must establish input provenance separately: hashes validate integrity,
not Claude identity or authorization. This tool cannot admit a packet into the
portable collector or provide its missing origin-verification callback.

```text
node command-center/reply-recheck-cli.mjs PRIVATE_CANONICAL_ROOT NEW_OUTPUT.json PRIOR_PLAN.json PACKET.json [PACKET.json ...]
```

Use `-` for the first prior plan. Explicit paths stay inside one existing canonical
0700 directory outside Git. Inputs and new exclusive outputs are 0600; symlinks,
overwrites, malformed reviews and conflicting observations are refused. There are
at most 100 input packets and 100 references. Overflow stops rather than discarding
older items. No provider, browser, home credential, subprocess or network is used.

Only source IDs, URLs, revisions, observation times and packet/run references are
retained. No subject, body, draft text, status, urgency, owner or due date is copied.
Expired packets supply historical handles only. Empty/partial/failed checks cannot
remove them. The worklist is **not an open-task ledger**: every reference needs a
source recheck and may already be handled. It cannot be assembled as a Site feed,
and generating it grants no permission to fetch its links.

## Producer reconciliation after the existing consent hold is resolved

Use the retained communications owner and existing work-account connections. Do not
start a parallel routine or use Codex Slack access. The refused cloud communications
export remains held; this document is preparation, not a revised prompt or bypass.

1. Recheck the explicitly retained references, including older ones outside the
   recent-message window. Preserve stable obligation IDs across email, Slack and
   reviewed meeting mentions. Similar titles alone are not duplicate evidence.
2. For previously undiscovered work, propose a bounded initial 30-day work-mail
   review, up to 100 candidate threads. That limit is a preparation default, not
   proof of coverage or an executed read. State exclusions, pagination/truncation,
   account/folder coverage and any older-than-window gap explicitly.
3. Check relevant Sent evidence and the subsequent thread before describing a
   request as unanswered. An empty Sent response remains unverified coverage.
   Read/unread flags alone never resolve a request.
4. Distinguish needs Steve's reply, waiting on another person, delegated work,
   handled/closed, and unresolved evidence. Use observed commitments and deadlines
   for urgency; do not invent priority or infer an answer from elapsed time.
5. Create a fresh, reviewed V2 packet containing only still-actionable executive
   summaries and authoritative links. Keep existing draft references where reviewed;
   do not send or create drafts externally. Feed observation/expiry must reflect
   actual new source reads. Old handles are not permission to renew old summaries.
6. Keep a reviewed reconciliation receipt for handled items outside the Site. The
   current worklist intentionally has no automatic deletion/closure command. A
   later refresh must not treat its reference count as an open-mail count. Automatic
   producer integration and evidence-bound pruning are not implemented by this tool.

## September 15 preparation evidence

Four explicitly selected existing V2 exports passed strict validation and yielded
nine unique historical references in the private handoff worklist. None was read
from Outlook or Slack in this preparation. Whether any remains unanswered or urgent
is unknown. No rejected malformed packet, V1 audit file or raw mailbox was imported.

Eight focused tests cover omission/expiry/failed reads, repeat replay, prior-plan
continuation, conflicts/tampering, strict review/shape and bounds, and offline CLI
private-file handling. This establishes preparation behavior, not live coverage.

## Unattended delivery still needs an authenticated transport

The existing meeting producer delivered via the awake Mac helper. Drive backing
does not establish cloud-to-cloud origin verification. The portable collector
requires a trusted `verifyClaudeOrigin` callback, which remains unconnected. Do not
create a fake verifier based on a filename or a packet's own hash. Authenticate the
retrieved object and bind its exact content to the independently observed producer
receipt before admitting it. Keep the existing local consumer until two scheduled
cloud collection/review/publication cycles succeed with the Mac off. No new timer,
credential, access grant, source publication or schedule change is part of this work.
