# Existing automation ownership and duplicate cleanup

Expanded audit verified September 13, 2026, evening Mountain time. This records
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
and cleanup do not publish the pending 23-item Site proposal or approve any
external action. The existing Site/source publication approval remains pending.


## Full cross-platform audit and additional cleanup

The registered schedules in the signed-in Mac apps and ChatGPT web account were
compared with local scheduler/configuration files. This is not an inventory of every
remote host or another user's account. Registered/enabled means configured to run;
it does not establish a recent successful result or complete data coverage.

| Surface | Verified state after cleanup | Evidence scope |
| --- | --- | --- |
| Claude Code | 9 enabled, 2 paused | Live Scheduled task list and relevant detail views |
| Claude Cowork | 7 enabled, 2 paused | Live Scheduled task list and relevant detail views |
| ChatGPT web / Work | 1 active, 1 paused, 8 completed | Current Scheduled page; completed reminders are not recurring jobs |
| Codex | 4 active, 5 paused | Nine local automation configurations; run history not comprehensively verified |
| Relevant local launchd helpers | 4 loaded, 3 persistently disabled/unloaded | Loaded service state, parsed saved dictionaries and disabled-service readback |
| sevaro-ops task registry | 27 definitions | manifest.json and linked scheduled-task directory; definitions are not proof of registration |

Additional verified changes in this expanded audit:

| Existing task | Action | Reason / preserved dependency |
| --- | --- | --- |
| Claude Code Dhruv reply monitor | Paused; UI shows Paused / switch off | Its explicit September 7 end time passed. Its September cron had rolled to September 2027. The paired Codex follow-up was already paused. |
| Local synapse-morning-brief | Persistently disabled and unloaded; file/script retained | Separate daily 08:00 private notification duplicates executive briefing and still counts preserved historical Asana queue entries as unflushed. It is deterministic, so this removes noise rather than model-token spend. team-digest.sh calls the script independently with BRIEF_AUDIENCE=team; that consumer was preserved and not executed. |
| Local synthesis-phase2-reminder | Persistently disabled and unloaded; file/script retained | Expired May 29 one-shot reminder remained registered with an annual calendar trigger. No clinical flag, deployment decision or notification was executed. |
| Local asana-repo-snapshot | Retirement made persistent; remains unloaded | It was already unloaded but lacked a persistent disable entry. The repaired monitor remains the retained local health path, with Asana writes off. |

Together with the two earlier morning-brief pauses, five redundant/expired routines
were stopped. No definitions or history were deleted. No aggregate token or dollar
savings are claimed: configured cadence is not an execution/billing receipt.

## Retained registered jobs and capability ownership

| Owner | Retained jobs | Why they remain |
| --- | --- | --- |
| Claude Code | Riya chat; Leadership prep reminder; Daily scribe feedback triage | Authorized collaboration, prep and feedback responsibilities; do not move underlying clinical/Slack content into Codex or Sites. |
| Claude Code | Labs coordination; Synapse lab weekly status | Existing initiative reconciliation and weekly status proposal ownership. Asana changes remain gated; no competing status database. |
| Claude Code | Clara blockers poll; Scribe open beta poll | Existing Slack answer/blocker checks. They complement Codex synthetic observation and public endpoint checks rather than duplicating their evidence. |
| Claude Code | Biweekly claude config health (1st/15th); Monthly expense sweep | Claude-specific configuration review; separate expense workflow. Routine financial output stays outside Today. |
| Cowork | Comms morning briefing; Comms afternoon check; Weekday afternoon digest — meetings + project handoffs | Communications ingestion, sent-reply reconciliation and meeting commitments. Reuse these outputs rather than adding another inbox/meeting agent. |
| Cowork | Sevaro Labs Cockpit — weekday morning refresh | Existing presentation owner; actual UI schedule is Monday 05:00. Consumer/ownership migration is not proven, so it remains. |
| Cowork | Meshi AI subscription reminder; Gemini API key reminder; Monthly file audit | Distinct subscription/configuration reminders and document hygiene. A reminder does not authorize credentials or access changes. |
| ChatGPT Work | Retatrutide FDA Watch | Distinct personal watch. No duplicate was established; not an executive Site feed. |
| Codex | Clara 48-hour feedback observation, every 2 hours | Bounded synthetic observation, ending September 15 at 15:45 UTC; preserve the existing stop condition and quiet unchanged behavior. |
| Codex | Scribe API recovery alert, every 6 hours | Public endpoint recovery check; existing successful-recovery stop condition. No competing Slack ingestion. |
| Codex | Weekly Sol efficiency review, Monday 09:00 | OpenAI-specific policy/configuration review, explicitly Luna/low in local config. Different platform from Claude configuration health. |
| Codex | Weekly XR doc sync, Monday 09:00 | Official Android XR/Samsung documentation changes. Neither a headset runtime test nor the definition-only issue poll. Model is not explicit in the inspected config. |
| Local helpers | Claude memory watcher; end watcher; lane health; Asana session monitor | File sync, quiet activity reminder, engineering lane check and monitor-only queue health. These helpers are not themselves competing LLM brief generators. |

Already paused/completed jobs stay stopped: Claude Phase 2 exam-phrase prediction,
Cowork NYC trip reply check, Codex release-approval check, Clara deployment readiness,
Dhruv handoff follow-up, overnight credential investigation and expired usage-pace
watch. Eight completed ChatGPT reminders are history, not eight active automations.

The Ops registry also contains dormant/one-time reviews, old credential reminders,
clinical batch work and a daily Clara report definition. They were not enabled or
executed. Its old registration note is contradicted by the live Claude task list;
use live registration evidence for current activity. The disabled LLM Asana session
sync definition must stay off; it was replaced by the deterministic monitor. The
disabled weekly token optimization definition was superseded by biweekly Claude
configuration health. Do not activate these files merely to test for duplication.

## What belongs in the existing Command Center

Use the existing Agents / System Health section for retained weekly checks and
major processes: short stable name, actual last successful completion, next expected
run when known, coverage and an actionable failure/change. An enabled schedule or an
old written definition must never be displayed as a successful run.

Only changed decisions, risks, deadlines, blockers or failures belong on Today.
Routine successful weekly checks, every daily run, personal subscription reminders,
raw prompts, inboxes, Slack content and automation logs do not. Multiple observations
of one source action should retain its identity and supporting evidence, not create
multiple decision cards. This audit adds no new dashboard, report or scheduler.
The mapping above is documented; comprehensive weekly run receipts are not yet wired
into the published Site.

Remaining reliability work, distinct from duplication:

- Cowork communications has stale reviewed output and recent failed runs. Retained
  morning/afternoon routines must establish a fresh source and sent-message check.
- The cloud afternoon meeting digest has useful coverage, but delivery of its
  reviewed metadata into the local shared export remains unproven.
- The local lane-health job's loaded last exit is 1. Its cause is not established;
  do not automatically run its SSO/provider canaries or claim it healthy.
- Two schedule names/descriptions disagree with actual recurrence (morning comms
  and Labs Cockpit). Preserve current schedules until intent is reconciled.
- Same-action exports with different IDs still need an end-to-end deduplication
  sample. Current duplicate-ID checks do not prove semantic deduplication.
- Other hosts/accounts and comprehensive execution/token receipts were not available
  in this audit. No claim of universal coverage or measured savings.

## Audit incident and recovery

An audit agent used `plutil -extract ProgramArguments xml1` without an explicit
output option and overwrote seven saved launchd plist dictionaries with argument
arrays. A disposable synthetic reproduction established the cause; the agent's
claim that the command was read-only was incorrect. The already loaded jobs retained
their runtime configurations.

All seven saved configurations were restored from preserved backups, canonical
installer/templates or the loaded service state. An independent review caught and
closed two gaps: memory-watcher's Background process type and 30-second throttle
were restored, and the retired Asana snapshot caller was persistently disabled.
No jobs were restarted or executed as part of recovery. Three reconstructed files
are functionally matched to observed fields, not byte-for-byte original XML;
reboot/reload acceptance was not performed. The subsequent two intentional job
retirements above are separate from recovery.

Private damaged inputs and recovery/retirement receipts are preserved under
`~/.local/state/sevaro/automation-audit-recovery-20260913/` with directory mode 0700
and artifact mode 0600. No raw logs, credentials, patient data or private payloads
are committed. Future plist inspection must use read-only plistlib parsing or an
explicit stdout output option, never the mutation-prone extraction invocation.
