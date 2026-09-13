# Steve Command Center: private visual and native voice surfaces

Decision direction, September 13, 2026: prefer **ChatGPT Sites for the private
visual cockpit**, **native ChatGPT Voice for conversation**, and
**blondarb/sevaro-hub for shared integration, normalization and business logic**.
The integration bridge is not yet implemented or accepted. Build read-only
context first; do not create another portfolio database or custom speech stack.

## Current implementation versus gaps

Inspected `codex/portfolio-operating-system` at `227f41e` (already committed and
on origin, despite its July HANDOFF calling it uncommitted). No PR existed for
that branch at inspection. Main has later docs; this architecture branch is
stacked on the portfolio branch to preserve its ownership and implementation.

| Existing code | Reuse / limitation |
| --- | --- |
| `src/lib/portfolio.ts` | Typed records, source references, validation, health and linking logic; useful pure-code patterns. Its stage/priority enums are a local taxonomy and must not silently translate Asana's actual stages or invent priorities. |
| `src/components/portfolio/PortfolioBoard.tsx` | Reuse selected detail/link components for drill-down. Entire board is not the new default screen. |
| `/admin/portfolio` | Existing Cognito-admin route; do not transplant its auth into Sites or expose clinical admin endpoints. |
| `src/data/portfolio.json` | July 17 static snapshot: 13 projects, 14 features, 4 ideas, 3 decisions, 4 sources; 12/13 projects not fully verified. Never use it as current initiative truth. |
| Portfolio tests | Existing validation/filter/link/UI coverage; 114 passes are a historical receipt, not current validation for new integration. |
| Improvement Queue linkage | Exact project IDs / unique repo aliases are reusable; that DynamoDB feature is not a new executive status store. |

Missing: live Asana adapter, approved Claude export contract, calendar/prep input,
normalized exception feed, source freshness semantics, shared Voice retrieval,
read-only Site backend route, transport authentication, and a verified private
visitor test. No Sites manifest or native voice bridge exists on this branch.

## Feasibility in this account/runtime

**Verified now:** Sites discovery succeeds for Steve's account. Two existing
Sites are active with custom access restricted to the owner, no groups or
external visitors. They were inspected for metadata only; their content,
databases and secrets were not read. They belong to other work and will not be
repurposed. Private deployment/access-management tools are present.

The installed Sites runtime supports a Cloudflare Worker frontend/backend,
platform sign-in and HTTP/HTTPS. Private Sites require sign-in. Authentication
and authorization remain separate; the audience must stay owner-only, and API
routes must enforce identity too. Account discovery is not proof a future build
or connector integration has passed acceptance.
[Official Sites documentation](https://learn.chatgpt.com/docs/sites).

**Not established:** there is no documented automatic inheritance of this
conversation's connected Asana/Outlook/GitHub tools into a deployed Site. No
account-specific connected-app bridge is exposed by the inspected Sites tools.
Treat those credentials and APIs as unavailable to Site code until a supported
integration path is implemented and verified. Sites' own MCP connection metadata,
where present, describes tools a Site exposes; it is not proof the Site can call
all of ChatGPT's plugins. Do not copy a PAT, AWS key, Codex login token, or local
Control Plane socket into a Site.

| Information | Narrowest path |
| --- | --- |
| Asana tasks, decisions and authoritative fields | Hub adapter reads specifically allowed project/task metadata and approved excerpts; Site receives normalized exceptions plus deep links. No raw full-board dump. |
| Outlook / email / Fyxer meetings | Existing Claude/Cowork direct ingestion → approved PHI-free executive export. Hub validates it. Site and Voice reuse the same draft/reference instead of re-ingesting or regenerating. |
| Upcoming calendar preparation | Claude's existing calendar path exports relevant next-24–48h prep items; omit clinical/patient appointments and private personnel meetings before export. Missing feed means unavailable, not an empty calendar. |
| GitHub and Codex jobs | Hub reads source-backed PR/job metadata with freshness and links; do not expose full logs, prompts, credentials or diffs. |
| Documents | Approved titles and deep links to SharePoint/Drive. Do not copy whole documents or clinical attachments into Site storage. |
| Sync health | Aggregate counts/timestamps/fixed error codes from sevaro-ops `health.json`; local file is not remotely reachable yet. Expose it only through the reviewed Hub bridge. |
| Native Voice | A Work/Codex task retrieves the exact Hub context snapshot through a supported local tool or authenticated read endpoint. Tools available in this chat are not proof a separate web/mobile voice session has access. |

Official documentation supports native Voice coordinating work and using the
conversation/permissions of an existing Codex task. Current tool inventory also
has native voice handoff capabilities. No voice session was started and no
screen context was captured for this audit. Verify the intended account/device
in a synthetic session before claiming seamless Site-to-Voice continuity.
[Native ChatGPT Voice](https://learn.chatgpt.com/docs/features/voice).

## Smallest viable slice

1. Add the normalized **read-only exception projection** in this repository.
   Keep Asana GIDs, source-native stage/priority values and timestamps. Reuse
   portfolio validation/linking patterns; do not migrate stale static records
   into Asana. Start with queue health and a small explicitly allowed set of
   Asana decisions/blockers. Claude remains owner of email/meeting extraction.
2. Add a strict PHI-free export boundary and one shared context read operation.
   An initial local JSON export can prove normalization and Voice task access
   without any deployment. This is a disposable projection, not authoritative
   project storage. Missing/expired sources fail closed and appear unavailable.
3. Verify **authenticated delivery** of that exact projection to a private Site
   and native Voice using synthetic fixtures. Resolve supported user-delegated
   authentication before exposing a Hub endpoint. ChatGPT sign-in headers alone
   must never be forwarded as trusted identity to a publicly reachable Hub API.
   No broad CORS, public JSON feed, browser-stored backend credential, local
   tunnel, static shared key or authentication workaround.
4. Only after that boundary works, adapt a thin Site Today view from existing
   components. No D1/R2 project database, raw uploads, mail bodies, transcripts,
   autonomous actions, or custom voice service. A versioned Sites source mirror
   is a build artifact; GitHub remains the engineering home. Build from the same
   reviewed Hub commit rather than maintaining separate business logic in Sites.

The first useful live page shows decisions/blockers and sync exceptions with
source links. Reply drafts and meeting prep appear only when Claude's exports
are fresh and valid. Agent activity has explicit unavailable/stale states; it
must not infer work from a stale HANDOFF timestamp. Natural-language retrieval
and draft proposals grow on the same contract, not a second ingestion pipeline.

## Shared context contract (proposed, not an API already running)

One immutable `snapshot_id`, `generated_at`, `expires_at`, and `view_id`; a
per-source `last_successful_read_at`, health and explicit availability. Each
item has:

- stable `item_id` based on source system + canonical source ID;
- short `spoken_name`, category, concise context and an optional recommendation
  clearly labeled as a proposal, with its supporting source references;
- authoritative source URL, original revision/modified time, and actual owner,
  priority/stage/due date only when present in the source;
- `action_required_by_steve`, its evidence/reason, and `next_expected_event`;
- pending-action state and draft version where an exact proposal exists;
- explicit allowlisted content classification and provenance.

No free-form raw-source passthrough. The exporter selects approved content;
validation rejects unknown fields and unknown/clinical classification before
anything crosses into Sites. A redaction regex or `phi_free: true` field alone
is not sufficient assurance. Keep rejected content out of logs too. Event IDs,
URLs and titles must also be checked for identifiers; metadata can contain PHI.

The visual view and Voice retrieve the **same snapshot**, not independent queries
that happen to refer to the same project. Ordinal labels are a view-scoped map:
“2” → `item_id`, pinned to `view_id` and snapshot. Do not renumber while discussing
an item. If a source updates, announce the change and re-resolve references before
acting. No need for Steve to describe his screen, type commands, edit form fields
or maintain status. Optional native screen context is a convenience, not a
required synchronization mechanism.

## Exception-first experience

Default: Today, with one or two source-backed sentences and the count requiring
Steve. Display only items that change an action, decision, deadline, risk or
priority. No generic daily AI summary when nothing changed.

- **Needs your decision:** numbered stable names, context, recommendation,
  approve/defer/open-detail affordances. In the first read-only version, open
  authoritative detail; do not render a working approval button without a
  supported approval transport.
- **Needs your response:** important communication, why it matters, source-linked
  Claude/Fyxer draft when available. Omit unread counts and raw inboxes.
- **Urgent / blocked:** actual deadlines or explicit dependencies; do not invent
  urgency from an old timestamp or missing due date.
- **Delegated / waiting:** actual person/agent, task and expected next event.
  Stale only after the documented expectation or source freshness threshold.
- **Projects:** compact health with Asana drill-down, not a default full board.
- **Agents / system health:** exceptions, active engineering work and PR links.
  Successful routine runs are hidden; no raw automation logs or repetitive reports.
- **Calendar:** relevant next-24–48h meetings needing preparation/follow-up.

## Voice intent, drafts and approval

Native ChatGPT Voice is the conversation layer; no separate microphone UI,
Realtime service, TTS/STT dependency or custom assistant is planned.

“Tell me about number two” resolves the pinned item. “What do you recommend?”
uses the same source-backed context. “Okay, do that” produces a **proposed action**
with source revision, exact target and parameters; it is not blanket authority.
“Draft replies to the three important emails” asks Claude/Fyxer to reuse or
prepare those drafts. Voice reads and edits the same draft versions shown in
the cockpit, so a tone change creates a new revision rather than a competing copy.

“That’s good. Send it” can be explicit approval only after the exact current
draft, recipients and attachments have been presented and the target is
unambiguous. Before execution, refresh source/draft state; any material change
requires renewed approval. Keep proposed, approved, dispatching, succeeded,
failed and unknown states distinct. Uncertain sends must not be retried blindly.
The first slice has no send/write tool. Add execution later through existing
approved mechanisms, not direct Sites writes or a new action authority.

## Hard boundary and acceptance gates

**No PHI or patient-level information may enter Site code, build artifacts,
requests, logs, analytics, storage, prompts or Voice context.** Do not reuse the
Hub clinical feedback endpoints, database, examples or raw audit sources.
Sites does not support PHI processing or data/inference residency at launch.
[Official runtime limits](https://learn.chatgpt.com/docs/sites#understand-limits-and-unsupported-uses).

Before a real-data private Site: synthetic tests must demonstrate identical
visual/Voice snapshot and item 2 resolution; stale-source refusal; owner-only
access including direct API routes; no unreviewed fields; unavailable-source
behavior; and no write caused by browsing or conversational acknowledgment.
Verify payload/log exclusions before enabling any real executive feed.

Outstanding decisions are implementation/auth feasibility, not another operating
model: which supported authenticated Hub→Site/Voice bridge is available; proof
Claude can emit the narrow export without broadening current ingestion; and
native Voice access in Steve's intended task/device. Keep the existing cockpit
and ownership contract until these pass. No Site or UI was built or published
as part of this architecture evaluation.
