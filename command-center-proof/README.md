# Synthetic shared-context proof

This directory is the sole source of the proof. It reuses the Hub's source-linked,
validated-record approach without importing its stale portfolio fixture, clinical
routes, Cognito service, databases or a second portfolio UI. Its built-in fixture contains three invented examples. The same runtime can load
an explicitly approved, expiring executive snapshot; no real context is included in
source or build output and there is no write operation.

`context.mjs` owns one deeply frozen snapshot and numbered view. `worker.mjs`
serves it only to a configured owner behind authenticated Sites dispatch;
`browser.mjs` renders the response with textContent and registers optional
read-only WebMCP tools using the same pins and same-origin session. Registration
does not prove that native Voice can discover or invoke the tools.

The fixed snapshot expires September 20. Keep it immutable; do not update it
in place to make a stale acceptance test pass. A later fixture needs a new
snapshot/view ID and a fresh explicit acceptance test.

```sh
node --test command-center-proof/context.test.mjs
node command-center-proof/preview.mjs
node command-center-proof/build.mjs /absolute/isolated/site-staging
```

The preview runs only on loopback with a **synthetic identity shim**; it is not
authentication acceptance. The build copies an exact allowlist of shared runtime, release, source-link, page
and browser modules plus a module package declaration. Collectors, private context,
credentials and unrelated Hub data directories are never copied. Preserve the Site's own
`.openai/hosting.json` in the staging directory. No database or public assets
serve as an authentication bypass.

Hosting requires private owner-only Sites access **and** an exact
`PROOF_OWNER_SITE_USER_ID` binding, sourced from a verified owner session through
trusted Sites dispatch. This ID is Site-scoped; do not substitute an account ID,
infer one from email, trust a caller-supplied header on an exposed origin or use
first-visitor enrollment. Unset binding returns 503; no identity returns 401;
another user returns 403. There is no deployment of an app-owned auth stack.

The authenticated `/api/viewer` diagnostic returns only the visitor's own
Site-scoped ID. During setup it exposes no snapshot and changes no binding.
After independently verifying the Site's owner-only policy and the signed-in
owner session, the operator can use that ID for the exact runtime binding.

All context routes are GET-only/no-store. This fixture's phrase parameter is
synthetic only. Do not reuse a query-string interface for actual spoken input
without a separate request/logging privacy design; infrastructure may log URLs.
No raw utterance, email body, transcript, clinical material, arbitrary export or
connector credential is accepted. Host-only collectors prepare reviewed metadata;
they are not part of the hosted Worker.

Acceptance status and remaining gates: [receipt](../docs/command-center/SHARED_CONTEXT_ACCEPTANCE_20260913.md).
