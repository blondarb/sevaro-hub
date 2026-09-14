# Existing automation ownership and duplicate cleanup

Verified September 13, 2026 at approximately 6:25 p.m. Mountain. This records
existing schedules and how their reviewed outputs should enter the Command Center;
it is not another schedule, dashboard, or project-state database.

## Changes verified in the actual scheduling interfaces

| Existing task | Action | Evidence and reason |
| --- | --- | --- |
| ChatGPT Executive Inbox Brief | Paused; definition/history preserved | Scheduled showed Resume / Paused after the change. The prompt independently scans Gmail, Google Calendar and Asana and creates an executive reply/meeting brief, overlapping Claude and the intended shared-context executive layer. |
| Cowork Morning brief (chief-of-staff sweep) | Paused; definition/history preserved | Enable schedule is off and status Paused. This weekday 8 a.m. task explicitly invokes the same comms-morning-briefing skill as the retained task. Recent runs repeatedly showed Awaiting input. |

Steve authorized removal of verified duplication. Pausing preserves recovery and
makes no changes to source records or historical findings. The ChatGPT task can
later be repurposed to consume approved shared context once scheduled authenticated
retrieval is demonstrated; no new Gmail ingestion or new brief was introduced.

## Retained workflow and intended Hub input

| Existing owner | Actual schedule observed | Distinct responsibility | Integration state |
| --- | --- | --- | --- |
| Cowork Comms morning briefing | Every day about 4 a.m., local | Work communications and sent-message reconciliation; source-linked reply obligations and existing draft references | Retained. Existing reviewed export is stale; a new successful source review is needed. Description says weekday 6 a.m., which disagrees with the actual schedule; cadence was not silently changed. |
| Cowork Comms afternoon check | Weekdays about 2 p.m., local | Communications since morning and changed reply obligations | Retained; complements morning. Recent run list shows failures; fresh coverage is not proven. |
| Claude Code Labs coordination | Weekdays 7:30 a.m. and 1:30 p.m., local | Fyxer meeting context, Sent Items, initiative reconciliation, existing data.js ownership | Retained. Actual coordination and partial calendar v2 exports are prepared. It must not expand into inbox ingestion or enable legacy Asana writes. |
| Cowork Weekday afternoon digest — meetings + project handoffs | Weekdays 4 p.m., cloud-capable; Require this computer off | Today's Fyxer commitments and decisions, plus exceptions/conflicts in project handoffs | Retained. Read-only and no human message/file writes. Its output can supply reviewed meeting follow-ups; direct local export delivery is not yet established. |
| Cowork Sevaro Labs Cockpit — weekday morning refresh | Every Monday 5 a.m. in UI | Existing artifact presentation refresh | Retained pending exact ownership/dependency check. The weekday name does not establish a weekday schedule. Do not remove the existing Cowork presentation owner merely because a newer Site exists. |

The afternoon meeting digest explicitly skips clinical recordings and avoids raw
transcripts. Only PHI-free executive commitments, decisions, prep/follow-up flags
and source links may cross the Hub/Site boundary. Initials do not make patient-level
content acceptable. The cloud task cannot be assumed to see local files, and its
existing read-only policy is not silently expanded into Drive writes or local access.

The broader daily-email-digest and slack-inbox-check definitions exist under
Documents/Claude/Scheduled, but neither was present as its own enabled task in the
inspected Cowork schedule list. A definition is not a live automation. The former
has additional personal/clinic coverage and the latter can send chat check-ins;
neither was executed, enabled or deleted by this review. Preserve personal/clinical
material outside the executive Site. Other local Codex active tasks are distinct
engineering/feedback/documentation monitors, not a competing executive inbox sweep;
no changes were made to them.

## Preventing duplicate findings

- Keep one owner for communications collection: existing Cowork morning and afternoon
  passes. Afternoon updates changed obligations and reconciles sent replies; it does
  not create a second copy of the same pending reply or regenerate an existing draft.
- Keep Labs as the initiative reconciliation owner and Asana as the status authority.
  Meeting notes supply evidence/proposals, never a competing project status.
- Attribute an action to its actual message, event, or task. Preserve stable source
  identifiers across repeated runs and update its observation/revision rather than
  assigning a new identity for every digest. Do not merge distinct actions merely
  because their titles look similar.
- If morning, afternoon and Labs all encounter the same commitment, reconcile it
  into one action with supporting evidence. A status conflict stays explicit and
  approval-gated; do not silently choose the most recent prose.
- Existing Hub checks reject duplicate source/item IDs. They do not semantically
  deduplicate the same action exported under different IDs. Cross-routine receipt
  consolidation and ordered ownership of shared feed files remain to be proven
  before claiming comprehensive automatic deduplication.
- The Site and conversational tools read the same approved snapshot. Do not add
  a second ChatGPT inbox/calendar sweep to synthesize that view, or a scheduled
  report to announce routine successful collection. Surface changed decisions,
  replies, deadlines, blockers and failures only.

Next: connect the retained afternoon meeting output through the existing reviewed
export handoff, restore the current communications source/sent-message check, and
verify stable action identity on a repeated morning/afternoon sample. This inventory
and two pauses do not publish the pending 23-item Site proposal or approve any
external action. The existing Site/source publication approval remains pending.
