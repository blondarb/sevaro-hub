# Feedback Triage — Phase 1 Handoff (2026-04-14)

## Audience

Next Claude Code session picking up Phase 2 of the feedback triage implementation. Also the user (steve@sevaro.com) reviewing the work before any deploy.

## Current State

- **Build/test status:** `npm test` in `sevaro-feedback/.claude/worktrees/feedback-triage` → **16 tests passing** across 5 files. `npm run lint` (tsc --noEmit) → 0 errors. Working tree clean.
- **Branch — sevaro-feedback:** `feat/feedback-triage` has 10 commits ahead of origin/main. Pushed to origin for backup. NOT merged, NOT deployed.
- **Branch — sevaro-hub:** `feat/feedback-triage` has 1 commit (spec + plan). Pushed to origin for backup.
- **Live AWS state:** 2 new DynamoDB tables created and ACTIVE in us-east-2 on account 873370528823:
    - `sevaro-feedback-triage-history` (PK sessionId, SK timestamp, GSI themeId-timestamp-index)
    - `sevaro-feedback-triage-requests` (PK requestId, GSI status-requestedAt-index, TTL on `ttl` attribute, 72h)
- **Amplify / Lambda:** NO CHANGES. The running Lambda at `8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback` is still the old code. Phase 1 code change is in the feature branch, waiting for user-initiated deploy.
- **Spec + plan:** committed to `sevaro-hub/docs/superpowers/` on feat/feedback-triage branch. Also present as untracked files in sevaro-hub main working tree (harmless shadow copies).

## Work Completed

### Design phase (this session, before implementation)

Full brainstorming session resulting in:
- `sevaro-hub/docs/superpowers/specs/2026-04-14-feedback-triage-design.md` — 406 lines, Approach A (proposal-on-session + append-only decision log), 3 layers (log + theme classification + theme grouping), v1 scope with no red alert banner, list+detail UI variant, conversational refine-prompt flow, structured reject reasons.
- `sevaro-hub/docs/superpowers/plans/2026-04-14-feedback-triage.md` — 3500+ lines, 25 tasks across 6 phases, cross-repo (sevaro-feedback + sevaro-hub + new triage-feedback skill), TDD throughout.

### Phase 1 implementation — sevaro-feedback (feat/feedback-triage)

| Commit | Task | What |
|---|---|---|
| `7a65280` | 1 | vitest + aws-sdk-client-mock + @vitest/coverage-v8 dev setup (+ **npm correction**, not pnpm) |
| `2f34e90` | 2 | Created `sevaro-feedback-triage-history` + `sevaro-feedback-triage-requests` DynamoDB tables via `aws dynamodb create-table`, enabled TTL on requests table. Documented in `infra/triage-tables.md`. |
| `a2837bc` | 2 | Review follow-up: added `ttl` reserved-word note, GSI projection trade-off doc, example query snippets, ISO 8601 format pin, `expired` status clarification. |
| `79c758d` | 3 | Created `src/lib/triage-types.ts` (70 lines) + `src/lib/ddb-client.ts` (13 lines). Installed `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` + `@types/node` as devDeps. |
| `1ef59dc` | 4 | TDD — `src/handlers/triage-history.ts` with `postTriageHistory` + `getTriageHistory` (2 tests pass). Simplified `getTriageHistory` from plan's broken Query-with-catch to a direct Scan. |
| `d7b8cb9` | 5 | TDD — `src/handlers/triage-requests.ts` with `postTriageRequest`, `listPendingRequests`, `patchTriageRequest` (4 tests pass). Uses `randomUUID()` and 72h TTL. |
| `74804b2` | 6 | TDD — `src/handlers/themes.ts` with `listThemes` (2 tests pass). ScanCommand + distinct-themeId aggregation. |
| `56e13d9` | 7 | Added `triageProposal` to the existing `patchSession` in `lambda/sevaro-feedback-api/index.mjs`. Exported the function. Added SET + REMOVE semantics for null-to-clear. 2 new tests pass. **Also added 3 dev-only AWS SDK deps** (`client-s3`, `client-lambda`, `s3-request-presigner`) so vitest could import the `.mjs` entry. |
| `62a3796` | 7b | Follow-up fix: `normalizeRecord` now parses `triageProposal` back to an object on GET (else the UI would see a raw JSON string). Null fallback on parse failure, not `[]` like the array fields. |
| `565ca16` | 8 | Ported all 6 handler functions INLINE into `lambda/sevaro-feedback-api/index.mjs` using the existing low-level `DynamoDBClient + marshall/unmarshall` pattern. Added 6 new route dispatch blocks in the handler switch. Added `test/handlers/lambda-routing.test.ts` (6 integration tests) — **NO DEPLOY**. |

### Also on sevaro-feedback main (separate from feature branch)

| Commit | What |
|---|---|
| `dfc5495` | Your pre-existing defensive `normalizeRecord` hardening (you had this uncommitted when the session started — committed to main per your option-A choice) |
| `e4f4c6c` | `chore: gitignore .claude worktree dir` on main |

Both are pushed. No extra setup needed.

### Phase 1 implementation — sevaro-hub (feat/feedback-triage)

| Commit | What |
|---|---|
| `0ae3f6e` | Spec + plan committed on feat/feedback-triage. (Main has them as untracked shadow files — harmless.) |
| `a1bdd7f` | `chore: gitignore .claude worktree dir` on main |

### File map for the next session

```
sevaro-feedback/.claude/worktrees/feedback-triage/
├─ src/lib/
│  ├─ triage-types.ts       ← all triage TypeScript types (TriageProposal, TriageAction, etc.)
│  └─ ddb-client.ts         ← DynamoDB DocumentClient singleton + TABLES constants
├─ src/handlers/
│  ├─ triage-history.ts     ← TS pure module, tested, NOT imported by live Lambda (tech debt — see below)
│  ├─ triage-requests.ts    ← "
│  └─ themes.ts             ← "
├─ test/handlers/
│  ├─ triage-history.test.ts
│  ├─ triage-requests.test.ts
│  ├─ themes.test.ts
│  ├─ sessions-patch.test.ts
│  └─ lambda-routing.test.ts
├─ lambda/sevaro-feedback-api/index.mjs
│  (modified: patchSession exported with triageProposal, 6 new inline handlers,
│   6 new route dispatch blocks, normalizeRecord parses triageProposal)
└─ infra/triage-tables.md   ← DynamoDB schema + commands + rollback + example queries

sevaro-hub/.claude/worktrees/feedback-triage/
├─ docs/superpowers/specs/2026-04-14-feedback-triage-design.md
├─ docs/superpowers/plans/2026-04-14-feedback-triage.md
└─ docs/HANDOFF_2026-04-14-feedback-triage-phase1.md  ← this doc
```

## What Was NOT Done (deferred — all intentional)

1. **Lambda deploy.** Global rules say "ask before deploying to production" and `sevaro-feedback-api` is the live production API. Code is committed on the feature branch, waiting for human review + manual deploy.
2. **API Gateway routes.** 6 new routes need to be added to `8uagz9y5bh`: `POST/GET /feedback/triage-history`, `GET /feedback/themes`, `POST/GET /feedback/triage-requests`, `PATCH /feedback/triage-requests/{id}`. Each needs the existing `x-api-key` usage plan applied. Stage deploy after.
3. **IAM policy.** The Lambda execution role needs `dynamodb:PutItem/GetItem/UpdateItem/Query/Scan` on the two new tables + the `status-requestedAt-index` GSI.
4. **Curl smoke tests** against deployed stage — full commands in the Task 8 subagent transcript, also repeated in the "Required Next Steps" section below.
5. **PR open + merge** for sevaro-feedback feat/feedback-triage → main.
6. **TS handlers → Lambda integration.** `src/handlers/*.ts` are canonical unit-tested modules but are NOT imported by the running Lambda. Logic is duplicated inline in `index.mjs`. This is intentional tech debt — Phase 2+ doesn't block on it, but eventually the Lambda should either bundle via `tsup` or the TS files should be deleted in favor of the `.mjs` as source of truth.
7. **Phase 2-6:** Hub API routes (Tasks 9-14), triage-feedback skill (Tasks 15-17), triage UI (Tasks 18-20), analyze redesign UI (Task 21), IAM + Playwright + deploy (Tasks 22-24).

## Known Risks / Watch Items

1. **TS/MJS duplication is a correctness risk over time.** If someone edits `src/handlers/triage-history.ts` but not `lambda/sevaro-feedback-api/index.mjs`, behavior will silently diverge. The TS tests will still pass; the Lambda routes will return old logic. Recommend a future consolidation pass before the feature ships to real users.
2. **`proposalSnapshot` storage format differs between TS and MJS paths.** TS handler via DocumentClient stores it as a DynamoDB map; inline MJS handler in `index.mjs` stores it as a JSON string. Only the MJS path writes at runtime, so this is theoretical — but flagged because `getTriageHistory` and `listThemes` defensively handle both shapes.
3. **Three new dev-only AWS SDK packages** (`@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `@aws-sdk/s3-request-presigner`) were added to `sevaro-feedback/package.json` so vitest could import `index.mjs` to test it. This grows `node_modules` but doesn't affect production (they're already provided by the Lambda runtime). If a future engineer wonders why, this is the reason.
4. **`index.mjs` now 770+ lines, cascade-of-ifs router.** Growing fast. Not a problem today but if another feature adds 6 more handlers, we should extract a route table.
5. **Feature branch in sevaro-feedback has 10 commits.** That's a big PR. When you open it, consider whether to squash some of the Task-level commits (especially the Task 2 infra + Task 2 review follow-up into one infra commit). Pure aesthetic — doesn't affect correctness.
6. **`tsconfig.json` in sevaro-feedback has `include: ["src"]`**, so `tsc --noEmit` does NOT type-check the `test/` files. Vitest compiles them at test time via its own transformer, so they work, but errors in test files wouldn't show up in `npm run lint`. Consider a `tsconfig.test.json` later.

## Required Next Steps

### (A) Deploy Phase 1 to staging — in your preferred order

```bash
# 1. Review the diff
cd /Users/stevearbogast/dev/repos/sevaro-feedback/.claude/worktrees/feedback-triage
git diff origin/main..feat/feedback-triage -- lambda/sevaro-feedback-api/index.mjs

# 2. Bundle + upload the Lambda code
cd lambda/sevaro-feedback-api
zip -r /tmp/sevaro-feedback-api.zip . -x "*.test.*" "node_modules/*"
aws lambda update-function-code --profile sevaro-sandbox --region us-east-2 \
  --function-name sevaro-feedback-api --zip-file fileb:///tmp/sevaro-feedback-api.zip

# 3. (Optional) set env vars — only if you want to override the defaults
# WARNING: this REPLACES the env block, so merge with existing vars first
aws lambda get-function-configuration --profile sevaro-sandbox --region us-east-2 \
  --function-name sevaro-feedback-api --query 'Environment'
# Then add TRIAGE_HISTORY_TABLE and TRIAGE_REQUESTS_TABLE if needed

# 4. Attach IAM policy — find the execution role first
aws lambda get-function --profile sevaro-sandbox --region us-east-2 \
  --function-name sevaro-feedback-api --query 'Configuration.Role'
# Then attach an inline policy granting PutItem/GetItem/UpdateItem/Query/Scan
# on both new table ARNs and the status-requestedAt-index GSI

# 5. Add API Gateway routes to 8uagz9y5bh
# POST /feedback/triage-history
# GET /feedback/triage-history
# GET /feedback/themes
# POST /feedback/triage-requests
# GET /feedback/triage-requests
# PATCH /feedback/triage-requests/{id}
# (All integrated to the same Lambda, x-api-key usage plan, deploy stage)

# 6. Curl smoke test — from any shell with the API key set
BASE="https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback"
curl -s -X POST "$BASE/triage-history" -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"sessionId":"smoke-1","action":"proposed","themeId":"smoke","reviewerEmail":"steve@sevaro.com","proposalSnapshot":{"version":1}}'
curl -s "$BASE/themes" -H "x-api-key: $KEY"
curl -s "$BASE/triage-requests" -H "x-api-key: $KEY"
curl -s -X POST "$BASE/triage-requests" -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"requestedBy":"steve@sevaro.com","sessionIds":["smoke-1"]}'

# 7. Open a PR once smoke tests pass
gh pr create --repo blondarb/sevaro-feedback --base main --head feat/feedback-triage \
  --title "feat(feedback): triage handlers (Phase 1)" \
  --body "Implements Phase 1 of feedback triage per docs/superpowers/plans/..."
```

### (B) Run `/codex-review` on sevaro-feedback Phase 1

sevaro-feedback has **never been reviewed** by Codex per `docs/CODEX_REVIEW_LOG.md`. Phase 1 added ~500 lines of new code — worth a cross-model review before merging. Suggested:

```
Run /codex-review on sevaro-feedback, then /codex-fix in autonomous mode.
```

### (C) Start Phase 2 — sevaro-hub Hub API routes

Phase 2 builds the Next.js API routes in `sevaro-hub` that proxy to the Phase 1 Lambda endpoints. Tasks 9–14 of the plan. Start with Task 9 (vitest setup for sevaro-hub).

Prompt for that below.

## Files to Review First (next session)

If you're jumping into Phase 2 cold:

1. `sevaro-hub/docs/superpowers/plans/2026-04-14-feedback-triage.md` — the plan (start at line 1012, Task 9)
2. `sevaro-hub/docs/superpowers/specs/2026-04-14-feedback-triage-design.md` — the spec (context for why)
3. `sevaro-hub/docs/HANDOFF_2026-04-14-feedback-triage-phase1.md` — this doc
4. `sevaro-hub/src/lib/feedback-api.ts` — the existing feedback Lambda client (Phase 2 will add a sibling `triage-api.ts`)
5. `sevaro-hub/src/lib/verify-auth.ts` — auth pattern used by all admin routes
6. `sevaro-hub/src/app/api/feedback/analyze/route.ts` — the broken endpoint Task 11 will rewrite

## Prompt for Next Session

```
Repo: ~/dev/repos/sevaro-hub

I'm continuing the feedback triage implementation. Phase 1 (sevaro-feedback Lambda) is code-complete on feat/feedback-triage and waiting for manual deploy. Now starting Phase 2 (sevaro-hub Next.js API routes).

Read these first:
  - docs/HANDOFF_2026-04-14-feedback-triage-phase1.md
  - docs/superpowers/plans/2026-04-14-feedback-triage.md (start at Task 9, line 1012)

Resume with the superpowers:subagent-driven-development skill and execute Phase 2 Tasks 9-14. Work in the existing worktree at ~/dev/repos/sevaro-hub/.claude/worktrees/feedback-triage on branch feat/feedback-triage (one commit already present: the spec+plan). Tasks 9-14 create vitest setup, Hub proxy routes, a replacement /api/feedback/analyze, and approve/reject/refine-prompt routes. TDD throughout.

Stop and check in after Task 14 (end of Phase 2) before starting Phase 3 (triage-feedback local skill). Also flag if the sevaro-feedback Lambda hasn't been deployed yet — Phase 2 Hub routes proxy to it, so Phase 2 integration tests need the Lambda live.

AWS profile: sevaro-sandbox, region us-east-2. Package manager: pnpm for sevaro-hub (vs npm for sevaro-feedback — don't mix them up).
```
