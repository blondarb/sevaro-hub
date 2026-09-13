# Shared-context acceptance — September 13, 2026

**Result: partial local proof; hosted Site/native Voice acceptance has not passed.**
No real executive data, PHI, email bodies or raw transcripts entered the proof.
No external write, connector, custom voice stack or larger dashboard was built.

## Implemented

- One immutable snapshot `synthetic-context-20260913-v1`, view
  `synthetic-today-v1`; three stable numbered synthetic items.
- Visual response and read-only reference resolver share the exact object and
  pins. “Tell me about number two” resolves to `synthetic:blocker:harbor`, spoken
  name **Harbor dependency**. It never selects a current mutable list by ordinal.
- Expiry/view mismatch and ambiguous/action phrases fail closed. API routes
  accept no writes or imported payloads. Browser renders with textContent.
- Owner identity required server-side on every route; absent binding denies all
  context. No browser credential, delegated source API, database or local tunnel.
- Explicit four-file build allowlist keeps the rest of sevaro-hub out of Sites.

## Evidence and limits

| Acceptance check | Result |
| --- | --- |
| Identical snapshot/reference in local model and API tests | PASS, four Node tests cover identity, immutable ordinal mapping, expiry, request shape and write rejection |
| Missing/other identity and absent owner binding | PASS in synthetic Worker tests; not proof of hosted dispatch header integrity |
| Private Site registration | PASS: `appgprj_6aa6deb2d21881919267767a67b881fd`, access revision 1, custom owner-only allowlist, no groups, editors or external visitors; calling account is owner |
| Local browser + actual WebMCP tool invocation | PASS: visible item 2 was Harbor dependency; `read_shared_context` and `resolve_shared_context_item` returned the same snapshot/view and `synthetic:blocker:harbor` through the loopback synthetic identity shim |
| Published proof Site | NOT COMPLETE; `current_live_url` is null |
| Hosted owner sign-in and denied anonymous/second-account API access | NOT RUN |
| Exact Site-scoped owner ID binding | NOT CONFIGURED; fail-closed 503 remains |
| Native Voice invokes authenticated snapshot read and resolves item 2 | NOT RUN; code resolver and optional WebMCP registration are not Voice acceptance |
| Real-data bridge | DISABLED / NOT IMPLEMENTED |

The private Site is reserved at expected URL
`https://steve-context-proof.blondarb.chatgpt.site`; this is **not a live URL**.
Reuse its exact project ID; do not create another Site to retry publication.

## Current blockers

1. The Sites publishing flow requires a temporary source-repository credential
   in a per-command Git authorization header. The available shell tool has no
   opaque-secret/environment binding, and ambient credential-helper access to
   that provider failed (`unable to get password from user`). No credential was
   placed in a tool argument, command, file, Git configuration or commit. Use a
   runtime-supported secret transport that keeps the credential out of recorded
   tool arguments before publishing the prepared synthetic artifact. Do not
   broaden access, publish publicly or reuse a backend/PAT credential to work
   around this. This is a publishing transport limitation, not an approval denial.
2. Private policy metadata does not establish runtime authorization. Before
   context access, verify the owner session's trusted Site-scoped identity, set
   the exact binding, and test anonymous and another-account requests to both
   page and API. Do not use an SIWC bypass token as visitor-authentication evidence.
3. No native Voice session has performed the retrieval. No supported tool to
   start Steve's microphone session is exposed here. After private authentication
   works, Steve starts native Voice in the intended Work/Codex task. Confirm that
   task discovers a supported authenticated read tool; otherwise that capability
   is a separate blocker. Ordinary ChatGPT Voice app-tool access is not assumed.

## Required end-to-end receipt

After the blockers above are resolved, open this same private Site and have
native Voice read the snapshot through its supported authenticated tool. Record
only the synthetic snapshot/view IDs, item ID and result—not audio or a transcript.
The visual item 2 and spoken “tell me about number two” must both resolve to
`synthetic:blocker:harbor`. Repeat after a page reload with pins unchanged; reject
a different/expired view. “Okay, do that” must cause no write because none exists.
Require actual owner success plus anonymous/second-account denial at the API,
including attempted identity-header spoofing against the public dispatch origin.

No live Asana, GitHub, Outlook, calendar, draft reply or local health feed enters
Sites before that receipt passes. Real-data ingestion additionally needs a
reviewed allowlist/provenance boundary and supported delegated authentication;
a synthetic-only flag or regex is not PHI assurance. The visual and voice
surfaces remain consumers; Asana and other source systems retain authority.
