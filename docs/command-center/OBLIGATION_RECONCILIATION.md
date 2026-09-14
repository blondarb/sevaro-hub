# Reviewed obligation reconciliation and Cowork delivery

September 13, 2026. This extends the existing Command Center; Asana remains authoritative.

## One obligation, multiple sources

A reviewed Claude item may optionally carry `same_obligation_as: {item_id, source_revision}`. It must identify the **same concrete obligation**, never merely a related project, person or similar title. The referenced item must be a fresh, visible Asana item in this collection, with an exact matching revision. Kind, status, due date, requires-Steve and approval state must agree. Otherwise preparation stops with `source_conflict`; no business choice is made automatically.

The single rendered item retains Asana's fields. A bounded `evidence` array retains each supporting Claude item ID, source, revision and authoritative URL. Both the detail pane and conversational retrieval receive these links. Producers cannot inject the assembled evidence array. Unlinked similar-looking actions remain distinct. Existing exports need no schema migration; omit the optional assertion unless the mapping has actually been reviewed. Synthetic regression coverage proves three source mentions produce one numbered item with two supporting links. It does not claim that every real obligation has been reconciled.

## Existing refresh hook imports reviewed files

`command-center/refresh-cli.mjs` now runs the bounded importer inside the existing refresh lock before collection. The existing Labs routine's step 7b already calls this hook; there is no additional timer, report, source-ingestion agent or Site publication path. The next timed Labs/Cowork run remains an operational acceptance check.

Host-only `cowork-import-config.json`, beside the private refresh plan, binds exactly `account_id` and `workspace_id` to the verified Cowork account/workspace. Missing/invalid configuration fails closed. IDs are not credentials; keep this machine binding out of source and Site bundles. Only that pair's `local_<UUID>/outputs/claude-replies.json` and `claude-meetings.json` are considered, with at most 2048 session directories. No session logs, raw messages, other artifacts or other account/workspace contents are read.

- Replies: the retained `comms-morning-briefing` and `comms-afternoon-check` routines (with or without the existing `routine:` prefix).
- Meetings: `routine:weekday-afternoon-digest`, source `claude:meetings`. It never overwrites the leadership-prep `claude:calendar` feed.
- Session directories must be owned and private; ancestor/output directories cannot be writable by other users. Claude may produce 0644 files under a private session directory. The importer preserves producer permissions and writes accepted copies, one previous packet and receipts at 0600 inside the 0700 private handoff directory.
- V2 review hashes bind projected fields and actual run receipts; they are not signatures, PHI detectors or Steve's publication approval.
- Exact retries do not rewrite accepted content. Equal-observation or same-run conflicts, regressing evidence and invalid receipts hold delivery. Current, retained receipt and previous packet constrain recovery. A missing current file cannot bypass that floor. Exports finishing after the pinned refresh time wait for the next run.
- `cowork-import-health.json` records only source, state, fixed failure code and check time. Import conflicts prevent that source from being treated as a current healthy feed. Partial empty results do not mean no work exists. Existing source expiry is preserved.

## September 13 actual meeting run

The existing cloud-capable weekday afternoon digest was updated in place, saved and read back: weekdays 16:00, existing model/connections unchanged. It now produces only a reviewed dedicated meeting packet, not another digest/self-email or upstream write. A bounded manual run produced zero approved-for-export items and explicitly partial coverage, observed 2026-09-14T02:38:04Z, expiring 04:38:04Z. No calendar source was available to that cloud run. Codex verified the exact visible artifact hashes and transferred that reviewed packet to the private handoff once. Nothing was published.

Cloud-only outputs do not appear in the local session tree. Automatic meeting delivery and upcoming meeting preparation therefore remain incomplete. The concrete next option is to run this same routine on Steve's Mac using its existing local calendar access; that requires the computer to be awake and a confirmed local execution/access setting. Do not claim this cloud run proved automatic delivery or complete calendar coverage.

## Release boundaries

No Asana writes, historical replay, live agent probes, source approvals or Site publication are enabled here. Exact content approval and the existing private Site publishing controls remain in force. Engineering monitor evidence is retained historical evidence, not a claim that failed model lanes recovered.
