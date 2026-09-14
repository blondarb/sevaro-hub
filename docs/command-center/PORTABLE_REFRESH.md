# Refresh without desktop access

The new offline CLI reuses the existing projection, Claude V2 validation and
review-binding functions. It does not call providers, publish, schedule work,
create credentials or authorize a business action. It can run on the locked Mac
or in a compatible Linux cloud workspace using explicitly supplied private files.
The CLI requires POSIX ownership/mode enforcement (Linux/macOS); it fails closed
on native Windows instead of assuming chmod protects its inputs.

The existing Mac collector remains unchanged. The portable wrapper removes its
fixed home-directory assumption from preparation and binding; it does not move
Asana credentials, GitHub authentication or Claude exports into the cloud.

## What is demonstrated

- Seven focused checks cover private files, exact independent grant/destination,
  source coverage, stale evidence, changed reviews, expiry and output collision.
- Prepare and bind succeed under Node 25.5 permission mode with network, child
  processes and home access denied, using only repository code and an ephemeral
  private directory. This is a sandboxed local test, not a remote acceptance run.
- The CLI reproduced the existing reviewed 19-item runtime snapshot and release
  digest exactly, while preserving the original consent and source timestamps.
  It did not publish or refresh evidence by re-binding it.
- Existing private v13 runtime publishing works through native Sites tools while
  the Mac is locked. In-app browser acceptance also worked independently of the
  native desktop lock. Native Claude computer use remained unavailable.

## Two explicit phases

Use a pre-existing owner-only 0700 directory outside Git. Inputs must be regular
0600 JSON files in that directory. Outputs are new exclusive 0600 files; existing
files are never overwritten. Only summary metadata is printed, including the
exact digest to review. No shell, provider or home-directory lookup is used.

The grant file contains the existing authorization and anchor. Pass the three
anchor values separately from protected operator configuration: authorization
SHA-256, exact Site project ID and exact saved version ID. Do not derive these
from an incoming packet, an arbitrary URL, or its proposed replacement grant.
A self-consistent hash is not proof of authorization.

Preparation:

```text
node command-center/portable-refresh-cli.mjs prepare ROOT input.json grant.json candidate.json AUTHORIZATION_SHA256 SITE_PROJECT_ID SAVED_VERSION_ID
```

The input has exactly `schema_version: 1`, `feeds` and `claude_exports`.
`feeds` contains only metadata feeds from the existing Asana, GitHub and sync
adapters. Retain the approved target allowlists and Dhruv exclusion upstream;
this wrapper cannot infer assignee exclusions from a normalized item. The grant,
not input data, supplies expected source coverage. Missing sources remain
unavailable and unexpected or duplicate sources reject.

**The standalone CLI does not yet accept real Claude packets.** V2 fields and
hashes prove structural integrity, not who supplied them. The library requires
an origin verifier supplied by trusted connector code before importing them.
No production verifier is installed, and input JSON cannot enable one. The
standalone bind command also rejects active Claude health, including Claude
evidence collapsed into an Asana item, so skipping preparation cannot bypass
origin verification. Use the existing trusted local review path for locally
verified Claude exports until a cloud origin verifier is connected. With no
verified export, leave `claude_exports` empty so those sources show unavailable.
Do not convert a Claude packet into an Asana/GitHub feed to get around this gate.

After actual Codex review, save a separate private review file with
`candidate_digest`, `reviewed_by: "Codex"`, the actual `reviewed_at`, and
`policy: "executive-project-context-v1"`. The CLI never invents that assertion.
Binding:

```text
node command-center/portable-refresh-cli.mjs bind ROOT candidate.json grant.json bound.json AUTHORIZATION_SHA256 SITE_PROJECT_ID SAVED_VERSION_ID review.json
```

The result includes the exact snapshot, release, original grant, distinct derived
receipt and `runtime_values`. These values are private executive payloads, not
credentials. They blank the unused legacy receipt and all unused chunk slots,
and intentionally omit owner bindings, proposal catalogs and delivery flags.
Before publishing, independently verify the destination and current grant, and
preserve the separately controlled action settings. Reuse only the pinned saved
Site version. A binding receipt is not publication or provider execution.

## Smallest persistent cutover

1. Keep the existing Claude communications/Labs/meeting routines. For cloud runs,
   remove local-folder, Apple Mail and desktop staging dependencies and use the
   existing authorized cloud connectors. Verify those connectors for this account.
2. Establish authenticated delivery of the exact reviewed export to the existing
   Hub workflow, with origin/account/workspace and packet digest verified outside
   the packet. Use one protected exchange location; it is a derived handoff, not
   another project-state database. No destination or new permissions are assumed.
3. Put the existing review/refresh routine in a cloud execution context with
   connector access, pinned grant/configuration and these portable helpers. It
   must not read the Mac, its credential cache or ClaudeSync over a tunnel.
4. Prove two scheduled cycles with the laptop shut down: fresh retained producer
   receipts, exact read-only snapshot publication, matching page/tool references,
   and failure/staleness visibility. Test unauthorized retrieval separately.
5. Retire the replaced local refresh caller only after that proof; keep one
   refresh owner and one separately gated Asana writer. Do not add parallel daily
   summaries, extend the seven-day permission or turn on delivery to force success.

Cloud scheduling capability is documented, but this account's complete delivery
path is not verified. Claude Code 2.1.259 exposes `--cloud` sessions and Codex CLI
0.154.0 exposes cloud task commands; neither installed CLI advertises management
of the retained Cowork schedule. No OpenAI CLI is installed. The existing MSI host is reachable over its current
SSH connection and has Node 24.13 at its installed path, but WSL is not installed;
no Linux runtime, account, software or schedule was added. Claude web opened to
sign-in rather than authenticated schedule controls. Creating a new cloud
session would not itself connect a retained schedule or retrieve its artifact.

Official references checked September 14, 2026:
- [Cowork scheduled tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork): cloud schedules can run without a computer; local app/file tasks remain local.
- [Cowork surfaces](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile): local connectors and computer access retain desktop dependencies.
- [ChatGPT scheduled tasks](https://learn.chatgpt.com/docs/automations): web tasks can use connected tools, but cannot directly use a local project folder.

Rollback: do not call the new offline entry point. Existing collection, source
ownership, Site v13 and approval settings are unchanged. Retain any review and
publication receipts; expired snapshots are never made current by rollback.
