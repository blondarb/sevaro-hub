# Shared-context acceptance — September 13, 2026

**Result: privately published, owner binding verified, and authenticated shared
retrieval demonstrated during native Codex Voice. Real-data acceptance remains held.**
No executive data, PHI, email bodies or raw transcripts entered the Site.

## Current receipt (supersedes the earlier publication diagnostics below)

The owner binding redeploy succeeded September 13 at 20:02:45 UTC, using saved
version 1 and environment revision 1. The owner-private page opened in Chrome and
the in-app browser. Its authenticated `read_shared_context` returned
`synthetic-context-20260913-v1` / `synthetic-today-v1`; the resolver invoked during
native Codex Voice returned item two, `synthetic:blocker:harbor`, Harbor dependency.
The action phrase “okay do that” was rejected. These were actual bound Site tools,
not the earlier loopback identity shim. The user has not separately completed an
exact spoken-number acceptance script, and other Voice clients remain untested.

Hosted anonymous/second-account and identity-header-spoofing tests are still open.
The newer runtime-delivery candidate is local only; twenty-six synthetic checks
pass. Synthetic A→B hosted delivery and retention/log safety remain open. No real
content is authorized for release. See `INTEGRATION_READINESS_20260913.md`.

## Earlier publication diagnostics (historical; not current status)

## Implemented

An authenticated self-identity diagnostic now supports owner setup. It returns
only the visitor's Site-scoped ID, never auto-enrolls anyone, and does not expose
the context while the exact owner binding is unset. Five synthetic tests pass.

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
| Identical snapshot/reference in local model and API tests | PASS, five Node tests cover identity, immutable ordinal mapping, expiry, request shape and write rejection |
| Missing/other identity and absent owner binding | PASS in synthetic Worker tests; not proof of hosted dispatch header integrity |
| Private Site registration | PASS: `appgprj_6aa6deb2d21881919267767a67b881fd`, access revision 1, custom owner-only allowlist, no groups, editors or external visitors; calling account is owner |
| Local browser + actual WebMCP tool invocation | PASS: visible item 2 was Harbor dependency; `read_shared_context` and `resolve_shared_context_item` returned the same snapshot/view and `synthetic:blocker:harbor` through the loopback synthetic identity shim |
| Published proof Site | PASS: saved version 1 deployed successfully September 13 at 19:41 UTC |
| Hosted owner sign-in and denied anonymous/second-account API access | PARTIAL: signed-in root returns owner_binding_not_configured; Worker logs show /api/viewer 200, but browser blocks displaying that response. Negative hosted authorization tests remain unaccepted |
| Exact Site-scoped owner ID binding | NOT CONFIGURED; fail-closed 503 remains |
| Native Voice invokes authenticated snapshot read and resolves item 2 | NOT RUN; code resolver and optional WebMCP registration are not Voice acceptance |
| Real-data bridge | DISABLED / NOT IMPLEMENTED |

The private Site is live at https://steve-context-proof.blondarb.chatgpt.site.
Reuse this Site; do not create another one. Saved source commit:
`17a08e8` (full revision retained in the Site source repository).

## Publication resolution and remaining blockers

Steve explicitly approved a one-time exception for this Site's short-lived
source credential in a recorded command. A newly reviewed source push succeeded;
packaging, saved version 1 and private deployment then succeeded. That exception
is not a general credential-policy change. No credential belongs in this receipt.

1. The signed-in browser reached the Worker: root returned 503 with
   `owner_binding_not_configured`, and the production Worker logged `/api/viewer`
   returning 200. The automated browser blocked displaying that response with
   `ERR_BLOCKED_BY_CLIENT`; captured network diagnostics reported `blockedReason:
   inspector`. The exact reason for that interception is not established. Do not
   disable browser protections or infer the owner ID from a different identifier.
   A normal user-opened verification page is the next diagnostic.
2. Exact owner binding is still unset. Verify the authenticated visitor identity,
   set the binding in Sites and redeploy the same saved version. Private access
   metadata alone does not prove runtime authorization. Unauthenticated HTTP
   probes returned edge error 1010; those are NOT evidence of Worker authorization
   or trusted-header spoofing resistance. Actual owner success and anonymous /
   second-account denial remain required. Never substitute a bypass token for
   visitor authentication evidence.
3. Native Voice is active in this Codex task, and built-in browser WebMCP is
   available, but neither has retrieved the hosted snapshot yet. Local WebMCP
   success with a synthetic identity shim remains local evidence only. Finish
   hosted retrieval and item-number comparison after owner binding works.

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
