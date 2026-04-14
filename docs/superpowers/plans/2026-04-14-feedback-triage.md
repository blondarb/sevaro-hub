# Feedback Triage & Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a semi-automated feedback triage loop — a local Claude Code skill classifies unreviewed feedback sessions with Bedrock, maps them to suspected code, and drafts fix prompts; humans review in a new Hub UI, approve (routing into the existing improvement queue), reject with structured reasons, or refine the prompt conversationally. Replace the broken `/feedback/analyze` endpoint with a theme-view page that groups feedback by pre-computed theme and flags denied themes with new votes.

**Architecture:** Cross-repo. Three locations: `sevaro-feedback/` (Lambda + DynamoDB backend), `sevaro-hub/` (Next.js UI + API routes), and `~/.claude/skills/triage-feedback/` (local Claude Code skill). Triage proposals are stored as a `triageProposal` field on existing session records; all decisions are append-logged to a new `sevaro-feedback-triage-history` table. Explicit "Run Triage" clicks enqueue to `sevaro-feedback-triage-requests` with 72h TTL. Approved proposals write to the existing `sevaro-improvement-queue` DynamoDB table for execution by the existing `/improvement-queue` skill.

**Tech Stack:** Next.js 15 (App Router, SSR), React 19, AWS SDK v3 (@aws-sdk/client-bedrock-runtime 3.1009, @aws-sdk/client-ses 3.1009, @aws-sdk/client-dynamodb), `jose` for JWT verification, Cognito (`us-east-2_9y6XyJnXC`), Bedrock Sonnet 4.6 (`us.anthropic.claude-sonnet-4-6` inference profile), DynamoDB, S3, AWS Amplify SSR hosting. Test framework: **vitest + @aws-sdk/client-mock + @testing-library/react** (not yet configured — Task 1 of Phase 2).

**Reference spec:** `docs/superpowers/specs/2026-04-14-feedback-triage-design.md`

---

## Pre-Flight

Before starting Phase 1, open a git worktree for this work (per `superpowers:using-git-worktrees` if available). All tasks assume the engineer is operating in an isolated branch:

```bash
cd /Users/stevearbogast/dev/repos/sevaro-hub
git worktree add .claude/worktrees/feedback-triage -b feat/feedback-triage
cd .claude/worktrees/feedback-triage
```

Or on `sevaro-feedback` for Phase 1:

```bash
cd /Users/stevearbogast/dev/repos/sevaro-feedback
git worktree add .claude/worktrees/feedback-triage -b feat/feedback-triage
cd .claude/worktrees/feedback-triage
```

Each repo gets its own worktree. Commits stay isolated per repo.

---

## File Structure (locked in before tasks)

### Files created

```
sevaro-feedback/
  src/handlers/triage-history.ts          # POST/GET triage-history endpoints
  src/handlers/triage-requests.ts         # POST/GET/PATCH triage-requests endpoints
  src/handlers/themes.ts                  # GET /themes (distinct themeIds)
  src/lib/triage-types.ts                 # shared TypeScript types
  src/lib/ddb-client.ts                   # DynamoDB client (if not already present)
  test/handlers/triage-history.test.ts
  test/handlers/triage-requests.test.ts
  test/handlers/themes.test.ts
  test/handlers/sessions-patch.test.ts
  vitest.config.ts
  infra/triage-tables.md                  # DynamoDB table creation commands

sevaro-hub/
  src/app/api/feedback/triage-history/route.ts
  src/app/api/feedback/triage-requests/route.ts
  src/app/api/feedback/triage-requests/[id]/route.ts
  src/app/api/feedback/themes/route.ts
  src/app/api/feedback/[id]/approve-proposal/route.ts
  src/app/api/feedback/[id]/proposal/route.ts
  src/app/api/feedback/[id]/refine-prompt/route.ts
  src/app/feedback/triage/page.tsx
  src/app/feedback/triage/TriageClient.tsx
  src/app/feedback/triage/SessionList.tsx
  src/app/feedback/triage/ProposalDetail.tsx
  src/app/feedback/triage/RefinePanel.tsx
  src/app/feedback/triage/RejectModal.tsx
  src/app/feedback/triage/ThemePopover.tsx
  src/lib/triage-api.ts                   # client for new routes
  src/lib/improvement-queue-api.ts        # client for improvement-queue API (if missing)
  src/lib/bedrock-refine.ts               # Bedrock refine-prompt wrapper
  vitest.config.ts
  test/lib/verify-auth.test.ts
  test/app/api/feedback/analyze.test.ts
  test/app/api/feedback/approve-proposal.test.ts
  test/app/api/feedback/refine-prompt.test.ts
  test/app/feedback/triage/ProposalDetail.test.tsx
  playwright.config.ts                    # Phase 6 only
  tests-e2e/feedback-triage.spec.ts       # Phase 6 only

~/.claude/skills/triage-feedback/
  SKILL.md                                # skill manifest + instructions
  scripts/triage.ts                       # main triage logic
  scripts/bedrock-client.ts               # Bedrock SDK wrapper
  scripts/hub-client.ts                   # Hub API client
  scripts/grep-repo.ts                    # local repo grep helper
  scripts/smoke-test.sh                   # end-to-end smoke test
  package.json                            # dependencies for scripts/
  tsconfig.json
```

### Files modified

```
sevaro-feedback/
  src/handlers/sessions.ts                # accept triageProposal in PATCH schema
  src/index.ts OR router config           # wire up new handlers
  package.json                            # add vitest, aws-sdk-client-mock devDeps

sevaro-hub/
  src/app/api/feedback/analyze/route.ts   # rewritten — query-based, no Bedrock
  src/lib/feedback-api.ts                 # add triageProposal field to FeedbackSession type
  src/app/feedback/page.tsx               # add "Triage queue" link/chip if pending > 0
  package.json                            # add vitest, @testing-library/react, @playwright/test
  CLAUDE.md                               # add Triage and Theme View under Body of Work
```

---

## Phase 1 — sevaro-feedback Lambda (backend schema + endpoints)

**Working directory:** `sevaro-feedback/.claude/worktrees/feedback-triage` (after pre-flight)

### Task 1: Set up vitest test framework in sevaro-feedback

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest and aws-sdk-client-mock**

```bash
cd /Users/stevearbogast/dev/repos/sevaro-feedback/.claude/worktrees/feedback-triage
pnpm add -D vitest @vitest/coverage-v8 aws-sdk-client-mock
```

Expected: packages added to `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
```

- [ ] **Step 3: Add `test` script to `package.json`**

Add to the `scripts` section:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs with zero tests**

```bash
pnpm test
```

Expected: `No test files found` or similar, exit code 0 or 1 but no crash.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore(feedback): set up vitest test framework"
```

---

### Task 2: Create DynamoDB tables `sevaro-feedback-triage-history` and `sevaro-feedback-triage-requests`

**Files:**
- Create: `infra/triage-tables.md` (documentation of the commands used)

- [ ] **Step 1: Authenticate AWS**

```bash
aws sso login --profile sevaro-sandbox
```

Expected: browser opens, SSO login succeeds.

- [ ] **Step 2: Create the history table**

```bash
aws dynamodb create-table \
  --profile sevaro-sandbox \
  --region us-east-2 \
  --table-name sevaro-feedback-triage-history \
  --attribute-definitions AttributeName=sessionId,AttributeType=S AttributeName=timestamp,AttributeType=S AttributeName=themeId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{"IndexName":"themeId-timestamp-index","KeySchema":[{"AttributeName":"themeId","KeyType":"HASH"},{"AttributeName":"timestamp","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'
```

Expected: JSON response with `"TableStatus": "CREATING"`.

- [ ] **Step 3: Create the requests table with TTL**

```bash
aws dynamodb create-table \
  --profile sevaro-sandbox \
  --region us-east-2 \
  --table-name sevaro-feedback-triage-requests \
  --attribute-definitions AttributeName=requestId,AttributeType=S AttributeName=status,AttributeType=S AttributeName=requestedAt,AttributeType=S \
  --key-schema AttributeName=requestId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{"IndexName":"status-requestedAt-index","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"requestedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'
```

- [ ] **Step 4: Enable TTL on the requests table**

Wait ~10 seconds for table to be `ACTIVE`, then:

```bash
aws dynamodb update-time-to-live \
  --profile sevaro-sandbox --region us-east-2 \
  --table-name sevaro-feedback-triage-requests \
  --time-to-live-specification Enabled=true,AttributeName=ttl
```

Expected: JSON response with `"TimeToLiveStatus": "ENABLING"`.

- [ ] **Step 5: Verify both tables are ACTIVE**

```bash
aws dynamodb describe-table --profile sevaro-sandbox --region us-east-2 --table-name sevaro-feedback-triage-history --query 'Table.TableStatus'
aws dynamodb describe-table --profile sevaro-sandbox --region us-east-2 --table-name sevaro-feedback-triage-requests --query 'Table.TableStatus'
```

Expected: both return `"ACTIVE"`.

- [ ] **Step 6: Document the commands**

Create `infra/triage-tables.md` with the exact commands used above so they're reproducible. Include table schemas, GSI purposes, TTL config, and a rollback command (`aws dynamodb delete-table ...`).

- [ ] **Step 7: Commit**

```bash
git add infra/triage-tables.md
git commit -m "infra(feedback): create triage-history and triage-requests DynamoDB tables"
```

---

### Task 3: Define shared types + DynamoDB client

**Files:**
- Create: `src/lib/triage-types.ts`
- Create: `src/lib/ddb-client.ts` (if not already present; check first)

- [ ] **Step 1: Check for existing DynamoDB client**

```bash
grep -r "DynamoDBClient" src/ --include='*.ts' | head -5
```

If an existing client exists, skip creating `ddb-client.ts` and import from the existing location.

- [ ] **Step 2: Create `src/lib/triage-types.ts`**

```ts
export type TriageClassification =
  | 'real_bug'
  | 'confused_user'
  | 'duplicate'
  | 'out_of_scope'
  | 'needs_info';

export type TriageAction =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'refined'
  | 'reverted';

export type RejectionReason =
  | 'not_a_real_issue'
  | 'already_fixed'
  | 'low_priority'
  | 'duplicate'
  | 'out_of_scope'
  | 'need_more_info';

export interface SuspectedFile {
  path: string;
  line: number;
  excerpt: string;
}

export interface ProposalRevision {
  version: number;
  prompt: string;
  instruction: string | null;
  createdAt: string;
}

export interface TriageProposal {
  version: number;
  createdAt: string;
  classification: TriageClassification;
  confidence: number;
  themeId: string;
  themeDescription: string;
  suspectedRepo: string | null;
  suspectedFiles: SuspectedFile[];
  rationale: string;
  revisions: ProposalRevision[];
}

export interface TriageHistoryEntry {
  sessionId: string;
  timestamp: string;
  action: TriageAction;
  proposalSnapshot: TriageProposal;
  themeId: string;
  reviewerEmail: string;
  reviewerNotes?: string;
  rejectionReason?: RejectionReason;
  rejectionComment?: string;
  improvementQueueItemId?: string;
}

export interface TriageRequest {
  requestId: string;
  requestedBy: string;
  requestedAt: string;
  sessionIds: string[];
  status: 'pending' | 'processing' | 'done' | 'expired';
  processedCount?: number;
  ttl: number;
}
```

- [ ] **Step 3: Create `src/lib/ddb-client.ts` (only if no existing client)**

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
});

export const TABLES = {
  sessions: process.env.SESSIONS_TABLE || 'sevaro-feedback-sessions',
  triageHistory: process.env.TRIAGE_HISTORY_TABLE || 'sevaro-feedback-triage-history',
  triageRequests: process.env.TRIAGE_REQUESTS_TABLE || 'sevaro-feedback-triage-requests',
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/triage-types.ts src/lib/ddb-client.ts
git commit -m "feat(feedback): define triage types and DynamoDB client"
```

---

### Task 4: TDD — `POST /triage-history` endpoint handler

**Files:**
- Create: `test/handlers/triage-history.test.ts`
- Create: `src/handlers/triage-history.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/handlers/triage-history.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { postTriageHistory } from '../../src/handlers/triage-history';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('POST /triage-history', () => {
  beforeEach(() => ddbMock.reset());

  it('writes an entry with required fields', async () => {
    ddbMock.on(PutCommand).resolves({});

    const result = await postTriageHistory({
      sessionId: 'a3f2',
      action: 'proposed',
      themeId: 'fonts-too-small',
      reviewerEmail: 'steve@sevaro.com',
      proposalSnapshot: { version: 1 } as any,
    });

    expect(result.statusCode).toBe(201);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.Item).toMatchObject({
      sessionId: 'a3f2',
      action: 'proposed',
      themeId: 'fonts-too-small',
      reviewerEmail: 'steve@sevaro.com',
    });
    expect(call.args[0].input.Item?.timestamp).toBeTruthy();
  });

  it('rejects invalid action values', async () => {
    const result = await postTriageHistory({
      sessionId: 'a3f2',
      action: 'nonsense' as any,
      themeId: 'fonts-too-small',
      reviewerEmail: 'steve@sevaro.com',
      proposalSnapshot: { version: 1 } as any,
    });
    expect(result.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test test/handlers/triage-history.test.ts
```

Expected: FAIL with "Cannot find module '../../src/handlers/triage-history'".

- [ ] **Step 3: Implement handler**

```ts
// src/handlers/triage-history.ts
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../lib/ddb-client';
import type { TriageHistoryEntry, TriageAction } from '../lib/triage-types';

const VALID_ACTIONS: TriageAction[] = ['proposed', 'approved', 'rejected', 'refined', 'reverted'];

export interface PostHistoryInput {
  sessionId: string;
  action: TriageAction;
  themeId: string;
  reviewerEmail: string;
  proposalSnapshot: TriageHistoryEntry['proposalSnapshot'];
  reviewerNotes?: string;
  rejectionReason?: TriageHistoryEntry['rejectionReason'];
  rejectionComment?: string;
  improvementQueueItemId?: string;
}

export async function postTriageHistory(input: PostHistoryInput) {
  if (!input.sessionId || !input.action || !input.themeId || !input.reviewerEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing required fields' }) };
  }
  if (!VALID_ACTIONS.includes(input.action)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid action' }) };
  }

  const entry: TriageHistoryEntry = {
    sessionId: input.sessionId,
    timestamp: new Date().toISOString(),
    action: input.action,
    themeId: input.themeId,
    reviewerEmail: input.reviewerEmail,
    proposalSnapshot: input.proposalSnapshot,
    ...(input.reviewerNotes && { reviewerNotes: input.reviewerNotes }),
    ...(input.rejectionReason && { rejectionReason: input.rejectionReason }),
    ...(input.rejectionComment && { rejectionComment: input.rejectionComment }),
    ...(input.improvementQueueItemId && { improvementQueueItemId: input.improvementQueueItemId }),
  };

  await ddb.send(new PutCommand({ TableName: TABLES.triageHistory, Item: entry }));
  return { statusCode: 201, body: JSON.stringify(entry) };
}

export async function getTriageHistory(params: { days?: number; groupBy?: 'theme' }) {
  const sinceMs = Date.now() - (params.days || 30) * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Scan approach for v1 — small data volume. Swap to GSI query once > 10k rows.
  const result = await ddb.send(new QueryCommand({
    TableName: TABLES.triageHistory,
    IndexName: 'themeId-timestamp-index',
    KeyConditionExpression: '#t >= :since',
    ExpressionAttributeNames: { '#t': 'timestamp' },
    ExpressionAttributeValues: { ':since': sinceIso },
  })).catch(async () => {
    // Fallback to full scan if GSI query shape is wrong
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    return ddb.send(new ScanCommand({
      TableName: TABLES.triageHistory,
      FilterExpression: '#t >= :since',
      ExpressionAttributeNames: { '#t': 'timestamp' },
      ExpressionAttributeValues: { ':since': sinceIso },
    }));
  });

  return { statusCode: 200, body: JSON.stringify({ entries: result.Items || [] }) };
}
```

Note: the GSI query above uses themeId as HASH which means a scan-like path. The scan fallback is the actual working path for v1; the GSI is there for future per-theme queries. Document this trade-off.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test test/handlers/triage-history.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/handlers/triage-history.ts test/handlers/triage-history.test.ts
git commit -m "feat(feedback): POST/GET /triage-history handler with tests"
```

---

### Task 5: TDD — Triage requests handlers (POST/GET/PATCH)

**Files:**
- Create: `test/handlers/triage-requests.test.ts`
- Create: `src/handlers/triage-requests.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test/handlers/triage-requests.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { postTriageRequest, listPendingRequests, patchTriageRequest } from '../../src/handlers/triage-requests';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('triage-requests', () => {
  beforeEach(() => ddbMock.reset());

  it('postTriageRequest creates a request with 72h TTL and pending status', async () => {
    ddbMock.on(PutCommand).resolves({});
    const now = Date.now();

    const result = await postTriageRequest({
      requestedBy: 'steve@sevaro.com',
      sessionIds: ['a3f2', 'b81c'],
    });

    expect(result.statusCode).toBe(201);
    const call = ddbMock.commandCalls(PutCommand)[0];
    const item = call.args[0].input.Item!;
    expect(item.status).toBe('pending');
    expect(item.sessionIds).toEqual(['a3f2', 'b81c']);
    expect(item.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.ttl).toBeGreaterThanOrEqual(Math.floor(now / 1000) + 72 * 60 * 60 - 10);
    expect(item.ttl).toBeLessThanOrEqual(Math.floor(now / 1000) + 72 * 60 * 60 + 10);
  });

  it('listPendingRequests returns only pending-status rows via GSI', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ requestId: 'r1', status: 'pending', sessionIds: ['a3f2'] }],
    });
    const result = await listPendingRequests();
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].requestId).toBe('r1');
  });

  it('patchTriageRequest updates status to processing/done', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { requestId: 'r1', status: 'done', processedCount: 3 },
    });
    const result = await patchTriageRequest('r1', { status: 'done', processedCount: 3 });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).status).toBe('done');
  });

  it('patchTriageRequest rejects invalid status transitions', async () => {
    const result = await patchTriageRequest('r1', { status: 'bogus' as any });
    expect(result.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test test/handlers/triage-requests.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement handler**

```ts
// src/handlers/triage-requests.ts
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ddb, TABLES } from '../lib/ddb-client';
import type { TriageRequest } from '../lib/triage-types';

const VALID_STATUSES: TriageRequest['status'][] = ['pending', 'processing', 'done', 'expired'];

export interface PostRequestInput {
  requestedBy: string;
  sessionIds: string[];
}

export async function postTriageRequest(input: PostRequestInput) {
  if (!input.requestedBy || !Array.isArray(input.sessionIds) || input.sessionIds.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing requestedBy or sessionIds' }) };
  }
  const now = Date.now();
  const entry: TriageRequest = {
    requestId: randomUUID(),
    requestedBy: input.requestedBy,
    requestedAt: new Date(now).toISOString(),
    sessionIds: input.sessionIds,
    status: 'pending',
    ttl: Math.floor(now / 1000) + 72 * 60 * 60,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.triageRequests, Item: entry }));
  return { statusCode: 201, body: JSON.stringify(entry) };
}

export async function listPendingRequests() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLES.triageRequests,
    IndexName: 'status-requestedAt-index',
    KeyConditionExpression: '#s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': 'pending' },
  }));
  return { statusCode: 200, body: JSON.stringify({ requests: result.Items || [] }) };
}

export async function patchTriageRequest(requestId: string, updates: { status?: TriageRequest['status']; processedCount?: number }) {
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid status' }) };
  }
  const exprNames: Record<string, string> = {};
  const exprValues: Record<string, unknown> = {};
  const sets: string[] = [];
  if (updates.status) {
    exprNames['#s'] = 'status';
    exprValues[':s'] = updates.status;
    sets.push('#s = :s');
  }
  if (updates.processedCount !== undefined) {
    exprNames['#p'] = 'processedCount';
    exprValues[':p'] = updates.processedCount;
    sets.push('#p = :p');
  }
  if (sets.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'no updates provided' }) };
  }
  const result = await ddb.send(new UpdateCommand({
    TableName: TABLES.triageRequests,
    Key: { requestId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: 'ALL_NEW',
  }));
  return { statusCode: 200, body: JSON.stringify(result.Attributes) };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test test/handlers/triage-requests.test.ts
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/handlers/triage-requests.ts test/handlers/triage-requests.test.ts
git commit -m "feat(feedback): triage-requests POST/GET/PATCH handlers with tests"
```

---

### Task 6: TDD — Themes endpoint (`GET /themes`)

**Files:**
- Create: `test/handlers/themes.test.ts`
- Create: `src/handlers/themes.ts`

- [ ] **Step 1: Write failing test**

```ts
// test/handlers/themes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { listThemes } from '../../src/handlers/themes';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('GET /themes', () => {
  beforeEach(() => ddbMock.reset());

  it('returns distinct themes with counts from history', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { themeId: 'fonts-too-small', action: 'proposed', proposalSnapshot: { themeDescription: 'Fonts small' } },
        { themeId: 'fonts-too-small', action: 'rejected', proposalSnapshot: { themeDescription: 'Fonts small' } },
        { themeId: 'login-auth-expired', action: 'approved', proposalSnapshot: { themeDescription: 'Auth expires' } },
      ],
    });
    const result = await listThemes();
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.themes).toHaveLength(2);
    const fonts = body.themes.find((t: any) => t.themeId === 'fonts-too-small');
    expect(fonts.count).toBe(2);
    expect(fonts.description).toBe('Fonts small');
  });

  it('returns empty list when history is empty', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const result = await listThemes();
    expect(JSON.parse(result.body).themes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test test/handlers/themes.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/handlers/themes.ts
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../lib/ddb-client';

export async function listThemes() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLES.triageHistory,
    ProjectionExpression: 'themeId, proposalSnapshot',
  }));
  const byId = new Map<string, { themeId: string; description: string; count: number }>();
  for (const row of result.Items || []) {
    const themeId = row.themeId as string;
    if (!themeId) continue;
    const existing = byId.get(themeId);
    if (existing) {
      existing.count += 1;
    } else {
      byId.set(themeId, {
        themeId,
        description: (row.proposalSnapshot as any)?.themeDescription || '',
        count: 1,
      });
    }
  }
  return { statusCode: 200, body: JSON.stringify({ themes: Array.from(byId.values()) }) };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test test/handlers/themes.test.ts
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/handlers/themes.ts test/handlers/themes.test.ts
git commit -m "feat(feedback): GET /themes distinct-themes endpoint with tests"
```

---

### Task 7: TDD — Extend existing sessions PATCH to accept `triageProposal`

**Files:**
- Create: `test/handlers/sessions-patch.test.ts`
- Modify: `src/handlers/sessions.ts` (exact file may differ — find the existing PATCH handler first)

- [ ] **Step 1: Locate existing sessions handler**

```bash
grep -rn "PATCH.*sessions\|updateSession\|patchSession" src/ --include='*.ts' | head -10
```

Note the exact file path and function name. The rest of this task assumes `src/handlers/sessions.ts` exports `patchSession`; adjust if different.

- [ ] **Step 2: Write failing test for the new field**

```ts
// test/handlers/sessions-patch.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { patchSession } from '../../src/handlers/sessions';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('PATCH /sessions/[id] — triageProposal', () => {
  beforeEach(() => ddbMock.reset());

  it('accepts triageProposal field and persists it', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { sessionId: 'a3f2', triageProposal: { version: 1 } },
    });

    const result = await patchSession('a3f2', {
      appId: 'evidence-engine',
      triageProposal: {
        version: 1,
        classification: 'real_bug',
        confidence: 0.92,
        themeId: 'fonts-too-small',
        suspectedFiles: [],
        revisions: [{ version: 1, prompt: 'test', instruction: null, createdAt: '2026-04-14' }],
      } as any,
    });

    expect(result.statusCode).toBe(200);
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call.args[0].input.UpdateExpression).toContain('triageProposal');
  });

  it('allows clearing triageProposal by setting to null', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { sessionId: 'a3f2' } });

    const result = await patchSession('a3f2', { appId: 'evidence-engine', triageProposal: null as any });
    expect(result.statusCode).toBe(200);
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call.args[0].input.UpdateExpression).toContain('REMOVE');
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
pnpm test test/handlers/sessions-patch.test.ts
```

Expected: FAIL — new field not supported.

- [ ] **Step 4: Modify `src/handlers/sessions.ts` PATCH handler**

Add `triageProposal` to the allowed update fields. The code below assumes the existing handler builds an `UpdateExpression` from a whitelist; modify that whitelist:

```ts
// In patchSession function, locate the ALLOWED_FIELDS array (or equivalent)
const ALLOWED_FIELDS = [
  'reviewStatus',
  'resolutionNote',
  'resolvedBy',
  'resolvedAt',
  'status',
  'actionItems',
  'triageProposal', // <-- add this
];

// In the update-expression builder, handle null-to-REMOVE:
for (const field of ALLOWED_FIELDS) {
  if (field in updates) {
    const value = (updates as any)[field];
    if (value === null) {
      removes.push(`#${field}`);
      exprNames[`#${field}`] = field;
    } else {
      sets.push(`#${field} = :${field}`);
      exprNames[`#${field}`] = field;
      exprValues[`:${field}`] = value;
    }
  }
}

const parts: string[] = [];
if (sets.length) parts.push(`SET ${sets.join(', ')}`);
if (removes.length) parts.push(`REMOVE ${removes.join(', ')}`);
const UpdateExpression = parts.join(' ');
```

Adapt the above to match the existing code style in `sessions.ts`. The key change is: whitelist `triageProposal`, handle `null` as REMOVE.

- [ ] **Step 5: Run tests**

```bash
pnpm test test/handlers/sessions-patch.test.ts
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/handlers/sessions.ts test/handlers/sessions-patch.test.ts
git commit -m "feat(feedback): PATCH sessions accepts triageProposal field"
```

---

### Task 8: Wire up new handlers in Lambda router + deploy to staging

**Files:**
- Modify: `src/index.ts` (or the Lambda entry/router — locate it first)

- [ ] **Step 1: Locate Lambda entry/router**

```bash
grep -rn "exports.handler\|export const handler\|export async function handler" src/ --include='*.ts'
```

Note the file and the routing pattern used (manual switch, @vendia/serverless-express, etc.).

- [ ] **Step 2: Register new routes**

Add routes to the router. Example for a manual switch-style router:

```ts
// In the main handler switch:
case 'POST /triage-history':
  return postTriageHistory(JSON.parse(event.body || '{}'));
case 'GET /triage-history':
  return getTriageHistory(event.queryStringParameters || {});
case 'POST /triage-requests':
  return postTriageRequest(JSON.parse(event.body || '{}'));
case 'GET /triage-requests':
  return listPendingRequests();
case 'PATCH /triage-requests/{id}':
  return patchTriageRequest(event.pathParameters!.id, JSON.parse(event.body || '{}'));
case 'GET /themes':
  return listThemes();
```

Import the handlers at the top of the file.

- [ ] **Step 3: Build the Lambda**

```bash
pnpm build
```

Expected: clean build, output in `dist/`.

- [ ] **Step 4: Add the new routes to API Gateway** (manual, not IaC)

Console walkthrough — for each new route, add it to API Gateway `8uagz9y5bh`:
- POST /triage-history → Lambda integration
- GET /triage-history → Lambda integration
- POST /triage-requests → Lambda integration
- GET /triage-requests → Lambda integration
- PATCH /triage-requests/{id} → Lambda integration
- GET /themes → Lambda integration

Each route needs the existing `x-api-key` usage plan applied. Deploy the API Gateway stage.

- [ ] **Step 5: Grant IAM permissions on the new DynamoDB tables**

Find the Lambda's execution role:

```bash
aws lambda get-function --profile sevaro-sandbox --region us-east-2 \
  --function-name sevaro-feedback-api --query 'Configuration.Role'
```

Attach an inline policy (or extend existing) granting `dynamodb:PutItem`, `GetItem`, `Query`, `Scan`, `UpdateItem` on the two new table ARNs and their GSIs. Document the policy JSON in `infra/triage-tables.md`.

- [ ] **Step 6: Smoke-test each new route with curl**

```bash
API_KEY="<redacted>"
BASE="https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback"

curl -s -X POST "$BASE/triage-history" \
  -H "Content-Type: application/json" -H "x-api-key: $API_KEY" \
  -d '{"sessionId":"smoke-1","action":"proposed","themeId":"smoke-theme","reviewerEmail":"steve@sevaro.com","proposalSnapshot":{"version":1}}'

curl -s -X GET "$BASE/themes" -H "x-api-key: $API_KEY"
curl -s -X GET "$BASE/triage-requests" -H "x-api-key: $API_KEY"

curl -s -X POST "$BASE/triage-requests" \
  -H "Content-Type: application/json" -H "x-api-key: $API_KEY" \
  -d '{"requestedBy":"steve@sevaro.com","sessionIds":["smoke-1"]}'
```

Expected: all return 2xx with the JSON shape from the handlers.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat(feedback): wire triage handlers into Lambda router"
```

Phase 1 complete: Lambda has all new endpoints, IAM is set, smoke-tested via curl. Push the branch.

---

## Phase 2 — sevaro-hub Hub API routes

**Working directory:** `sevaro-hub/.claude/worktrees/feedback-triage`

### Task 9: Set up vitest + @testing-library/react in sevaro-hub

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/stevearbogast/dev/repos/sevaro-hub/.claude/worktrees/feedback-triage
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Create `test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add test scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create a smoke test for `verify-auth.ts`**

```ts
// test/lib/verify-auth.test.ts
import { describe, it, expect } from 'vitest';
import { verifyToken } from '@/lib/verify-auth';

describe('verifyToken', () => {
  it('returns null for empty token', async () => {
    const result = await verifyToken('');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 6: Run**

```bash
pnpm test
```

Expected: 1 PASS.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts test/setup.ts test/lib/verify-auth.test.ts package.json pnpm-lock.yaml
git commit -m "chore(hub): set up vitest + @testing-library/react"
```

---

### Task 10: Hub proxy routes for triage-history, triage-requests, themes

**Files:**
- Create: `src/lib/triage-api.ts`
- Create: `src/app/api/feedback/triage-history/route.ts`
- Create: `src/app/api/feedback/triage-requests/route.ts`
- Create: `src/app/api/feedback/triage-requests/[id]/route.ts`
- Create: `src/app/api/feedback/themes/route.ts`

- [ ] **Step 1: Create `src/lib/triage-api.ts`**

```ts
const API_URL = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
const API_KEY = process.env.FEEDBACK_API_KEY || '';

const headers = () => ({ 'Content-Type': 'application/json', 'x-api-key': API_KEY });

export async function fetchTriageHistory(days = 30) {
  const res = await fetch(`${API_URL}/triage-history?days=${days}`, { cache: 'no-store', headers: headers() });
  if (!res.ok) throw new Error(`triage-history ${res.status}`);
  return res.json() as Promise<{ entries: any[] }>;
}

export async function postTriageHistory(entry: unknown) {
  const res = await fetch(`${API_URL}/triage-history`, { method: 'POST', headers: headers(), body: JSON.stringify(entry) });
  if (!res.ok) throw new Error(`triage-history POST ${res.status}`);
  return res.json();
}

export async function fetchPendingTriageRequests() {
  const res = await fetch(`${API_URL}/triage-requests?status=pending`, { cache: 'no-store', headers: headers() });
  if (!res.ok) throw new Error(`triage-requests GET ${res.status}`);
  return res.json() as Promise<{ requests: any[] }>;
}

export async function postTriageRequest(requestedBy: string, sessionIds: string[]) {
  const res = await fetch(`${API_URL}/triage-requests`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ requestedBy, sessionIds }),
  });
  if (!res.ok) throw new Error(`triage-requests POST ${res.status}`);
  return res.json();
}

export async function patchTriageRequest(requestId: string, updates: { status?: string; processedCount?: number }) {
  const res = await fetch(`${API_URL}/triage-requests/${requestId}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`triage-requests PATCH ${res.status}`);
  return res.json();
}

export async function fetchThemes() {
  const res = await fetch(`${API_URL}/themes`, { cache: 'no-store', headers: headers() });
  if (!res.ok) throw new Error(`themes ${res.status}`);
  return res.json() as Promise<{ themes: Array<{ themeId: string; description: string; count: number }> }>;
}
```

- [ ] **Step 2: Create the four Hub API route files**

All four follow the same pattern — verify admin auth, proxy to the Lambda client. Example for triage-history:

```ts
// src/app/api/feedback/triage-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';
import { fetchTriageHistory, postTriageHistory } from '@/lib/triage-api';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('id_token')?.value
    || req.headers.get('authorization')?.replace(/^Bearer /, '');
  const user = token ? await verifyToken(token) : null;
  if (!user?.isAdmin) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const days = Number(req.nextUrl.searchParams.get('days') || '30');
    const data = await fetchTriageHistory(days);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const entry = { ...body, reviewerEmail: user.email };
    const data = await postTriageHistory(entry);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

Clone this pattern for `triage-requests/route.ts` (GET, POST), `triage-requests/[id]/route.ts` (PATCH), and `themes/route.ts` (GET only — no admin gate needed? yes — still admin-gated, consistent with all feedback routes).

- [ ] **Step 3: Smoke test in Next.js dev server**

```bash
pnpm dev
# in another terminal, with a valid admin id_token cookie:
curl -s http://localhost:3000/api/feedback/themes -b "id_token=<token>"
```

Expected: 200 with themes array (empty initially).

- [ ] **Step 4: Commit**

```bash
git add src/lib/triage-api.ts src/app/api/feedback/triage-history src/app/api/feedback/triage-requests src/app/api/feedback/themes
git commit -m "feat(hub): proxy routes for triage-history, triage-requests, themes"
```

---

### Task 11: TDD — Replace `/api/feedback/analyze` with query-based theme endpoint

**Files:**
- Create: `test/app/api/feedback/analyze.test.ts`
- Modify: `src/app/api/feedback/analyze/route.ts` (rewrite)

- [ ] **Step 1: Read existing route to understand what to replace**

```bash
cat /Users/stevearbogast/dev/repos/sevaro-hub/src/app/api/feedback/analyze/route.ts
```

Note the Bedrock imports, prompt construction, JSON regex extraction — all removed.

- [ ] **Step 2: Write failing test**

```ts
// test/app/api/feedback/analyze.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/feedback/analyze/route';
import * as triageApi from '@/lib/triage-api';
import * as verifyAuth from '@/lib/verify-auth';

vi.mock('@/lib/triage-api');
vi.mock('@/lib/verify-auth');

describe('/api/feedback/analyze', () => {
  it('groups history entries by themeId with counts and re-surface flag', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue({ email: 'steve@sevaro.com', isAdmin: true } as any);
    vi.mocked(triageApi.fetchTriageHistory).mockResolvedValue({
      entries: [
        { themeId: 'fonts-too-small', action: 'rejected', timestamp: '2026-04-02', proposalSnapshot: { themeDescription: 'Fonts small' } },
        { themeId: 'fonts-too-small', action: 'proposed', timestamp: '2026-04-05', proposalSnapshot: { themeDescription: 'Fonts small' } },
        { themeId: 'fonts-too-small', action: 'proposed', timestamp: '2026-04-14', proposalSnapshot: { themeDescription: 'Fonts small' } },
        { themeId: 'login-auth-expired', action: 'approved', timestamp: '2026-04-10', proposalSnapshot: { themeDescription: 'Auth expires' } },
      ],
    });

    const req = new Request('http://localhost/api/feedback/analyze?days=30', {
      headers: { cookie: 'id_token=valid' },
    }) as any;
    const res = await GET(req);
    const body = await res.json();

    expect(body.stats.totalThemes).toBe(2);
    const fonts = body.themes.find((t: any) => t.themeId === 'fonts-too-small');
    expect(fonts.voteCount).toBe(3);
    expect(fonts.statusBreakdown).toEqual({ approved: 0, open: 2, rejected: 1 });
    expect(fonts.newVotesSinceDenial).toBe(2); // 2 proposed after the 2026-04-02 rejection
  });

  it('returns 401 when not admin', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue(null as any);
    const req = new Request('http://localhost/api/feedback/analyze') as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
pnpm test test/app/api/feedback/analyze.test.ts
```

Expected: FAIL — test expects new query-based behavior the route doesn't have.

- [ ] **Step 4: Rewrite `src/app/api/feedback/analyze/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';
import { fetchTriageHistory } from '@/lib/triage-api';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('id_token')?.value
    || req.headers.get('authorization')?.replace(/^Bearer /, '');
  const user = token ? await verifyToken(token) : null;
  return user?.isAdmin ? user : null;
}

type Entry = {
  themeId: string;
  action: 'proposed' | 'approved' | 'rejected' | 'refined' | 'reverted';
  timestamp: string;
  proposalSnapshot?: { themeDescription?: string };
};

type ThemeRollup = {
  themeId: string;
  description: string;
  voteCount: number;
  statusBreakdown: { approved: number; open: number; rejected: number };
  weeklyTrend: number[]; // 6 buckets, oldest → newest
  trending: boolean;
  newVotesSinceDenial: number;
  lastActivityAt: string;
};

function rollup(entries: Entry[]): ThemeRollup[] {
  const byTheme = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!e.themeId) continue;
    const list = byTheme.get(e.themeId) ?? [];
    list.push(e);
    byTheme.set(e.themeId, list);
  }
  const themes: ThemeRollup[] = [];
  const nowMs = Date.now();
  const bucketWidthMs = 7 * 24 * 60 * 60 * 1000; // 1 week per bucket
  for (const [themeId, list] of byTheme) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const desc = list[0]?.proposalSnapshot?.themeDescription || '';
    const buckets = [0, 0, 0, 0, 0, 0];
    let approved = 0, open = 0, rejected = 0;
    let lastRejectTs: string | null = null;
    for (const e of list) {
      if (e.action === 'proposed') open += 1;
      else if (e.action === 'approved') { approved += 1; open = Math.max(0, open - 1); }
      else if (e.action === 'rejected') { rejected += 1; open = Math.max(0, open - 1); lastRejectTs = e.timestamp; }
      const ageMs = nowMs - new Date(e.timestamp).getTime();
      const bucketIdx = 5 - Math.min(5, Math.floor(ageMs / bucketWidthMs));
      if (bucketIdx >= 0) buckets[bucketIdx] += 1;
    }
    const newVotesSinceDenial = lastRejectTs
      ? list.filter((e) => e.action === 'proposed' && e.timestamp > lastRejectTs!).length
      : 0;
    const lastHalf = buckets[4] + buckets[5];
    const firstHalf = buckets[0] + buckets[1];
    const trending = lastHalf > firstHalf && lastHalf >= 2;
    themes.push({
      themeId,
      description: desc,
      voteCount: list.filter((e) => e.action === 'proposed' || e.action === 'approved').length,
      statusBreakdown: { approved, open, rejected },
      weeklyTrend: buckets,
      trending,
      newVotesSinceDenial,
      lastActivityAt: list[list.length - 1].timestamp,
    });
  }
  return themes.sort((a, b) => b.voteCount - a.voteCount);
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const days = Number(req.nextUrl.searchParams.get('days') || '30');
    const data = await fetchTriageHistory(days);
    const themes = rollup(data.entries as Entry[]);
    const stats = {
      totalSessions: themes.reduce((s, t) => s + t.voteCount, 0),
      totalThemes: themes.length,
      trendingUp: themes.filter((t) => t.trending).length,
      newVotesSinceDenial: themes.filter((t) => t.newVotesSinceDenial > 0).length,
      awaitingTriage: 0, // wired by a separate call in Task 13
    };
    return NextResponse.json({
      timeRange: { from: new Date(Date.now() - days * 86400000).toISOString(), to: new Date().toISOString() },
      stats,
      themes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test test/app/api/feedback/analyze.test.ts
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/feedback/analyze/route.ts test/app/api/feedback/analyze.test.ts
git commit -m "feat(hub): rewrite /api/feedback/analyze as query-based theme rollup"
```

---

### Task 12: TDD — `POST /api/feedback/[id]/approve-proposal`

**Files:**
- Create: `src/lib/improvement-queue-api.ts`
- Create: `test/app/api/feedback/approve-proposal.test.ts`
- Create: `src/app/api/feedback/[id]/approve-proposal/route.ts`

- [ ] **Step 1: Create improvement-queue client**

```ts
// src/lib/improvement-queue-api.ts
const BASE = process.env.IMPROVEMENT_QUEUE_API_URL || 'https://ael0orzmsk.execute-api.us-east-2.amazonaws.com/improvements';
const API_KEY = process.env.IMPROVEMENT_QUEUE_API_KEY || '';

const headers = () => ({ 'Content-Type': 'application/json', 'x-api-key': API_KEY });

export async function createQueueItem(item: {
  repoName: string;
  prompt: string;
  source: string;
  needsHumanReview: boolean;
  reviewerNotes?: string;
}) {
  const res = await fetch(BASE, { method: 'POST', headers: headers(), body: JSON.stringify(item) });
  if (!res.ok) throw new Error(`improvement-queue POST ${res.status}`);
  return res.json() as Promise<{ promptId: string }>;
}
```

- [ ] **Step 2: Write failing test**

```ts
// test/app/api/feedback/approve-proposal.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/feedback/[id]/approve-proposal/route';
import * as queueApi from '@/lib/improvement-queue-api';
import * as triageApi from '@/lib/triage-api';
import * as feedbackApi from '@/lib/feedback-api';
import * as verifyAuth from '@/lib/verify-auth';

vi.mock('@/lib/improvement-queue-api');
vi.mock('@/lib/triage-api');
vi.mock('@/lib/feedback-api');
vi.mock('@/lib/verify-auth');

describe('POST /api/feedback/[id]/approve-proposal', () => {
  it('writes to improvement queue, patches session, logs approval', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue({ email: 'steve@sevaro.com', isAdmin: true } as any);
    vi.mocked(feedbackApi.getSession).mockResolvedValue({
      sessionId: 'a3f2', appId: 'evidence-engine',
      triageProposal: {
        version: 2, themeId: 'fonts-too-small', classification: 'real_bug', confidence: 0.92,
        suspectedRepo: 'sevaro-evidence-engine',
        revisions: [
          { version: 1, prompt: 'original', instruction: null, createdAt: '2026-04-14T09:00:00Z' },
          { version: 2, prompt: 'refined', instruction: 'add tests', createdAt: '2026-04-14T09:15:00Z' },
        ],
      },
    } as any);
    vi.mocked(queueApi.createQueueItem).mockResolvedValue({ promptId: 'queue-123' });
    vi.mocked(triageApi.postTriageHistory).mockResolvedValue({} as any);

    const req = new Request('http://localhost/api/feedback/a3f2/approve-proposal', {
      method: 'POST',
      headers: { cookie: 'id_token=valid' },
      body: JSON.stringify({ reviewerNotes: 'lgtm' }),
    }) as any;
    const res = await POST(req, { params: { id: 'a3f2' } } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.promptId).toBe('queue-123');
    expect(queueApi.createQueueItem).toHaveBeenCalledWith(expect.objectContaining({
      repoName: 'sevaro-evidence-engine',
      prompt: 'refined',
      source: 'feedback:a3f2',
      needsHumanReview: true,
    }));
    expect(triageApi.postTriageHistory).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'a3f2',
      action: 'approved',
      improvementQueueItemId: 'queue-123',
    }));
  });

  it('returns 404 when session has no triageProposal', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue({ email: 'steve@sevaro.com', isAdmin: true } as any);
    vi.mocked(feedbackApi.getSession).mockResolvedValue({ sessionId: 'a3f2', appId: 'e', triageProposal: null } as any);
    const req = new Request('http://localhost/', { method: 'POST', headers: { cookie: 'id_token=valid' }, body: '{}' }) as any;
    const res = await POST(req, { params: { id: 'a3f2' } } as any);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
pnpm test test/app/api/feedback/approve-proposal.test.ts
```

- [ ] **Step 4: Implement the route**

```ts
// src/app/api/feedback/[id]/approve-proposal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { createQueueItem } from '@/lib/improvement-queue-api';
import { postTriageHistory } from '@/lib/triage-api';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('id_token')?.value
    || req.headers.get('authorization')?.replace(/^Bearer /, '');
  const user = token ? await verifyToken(token) : null;
  return user?.isAdmin ? user : null;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sessionId = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  try {
    const session = await getSession(sessionId, body.appId || '');
    const proposal = (session as any).triageProposal;
    if (!proposal) {
      return NextResponse.json({ error: 'no triage proposal on session' }, { status: 404 });
    }

    const currentRevision = proposal.revisions?.[proposal.revisions.length - 1];
    if (!currentRevision?.prompt) {
      return NextResponse.json({ error: 'proposal has no prompt' }, { status: 400 });
    }

    const queueItem = await createQueueItem({
      repoName: proposal.suspectedRepo || session.appId,
      prompt: currentRevision.prompt,
      source: `feedback:${sessionId}`,
      needsHumanReview: true,
      reviewerNotes: body.reviewerNotes,
    });

    await postTriageHistory({
      sessionId,
      action: 'approved',
      themeId: proposal.themeId,
      proposalSnapshot: proposal,
      reviewerNotes: body.reviewerNotes,
      improvementQueueItemId: queueItem.promptId,
    });

    // Update the session: reviewStatus='resolved' + clear triageProposal
    const FEEDBACK_API = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
    await fetch(`${FEEDBACK_API}/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FEEDBACK_API_KEY || '' },
      body: JSON.stringify({
        appId: session.appId,
        reviewStatus: 'resolved',
        resolvedBy: user.email,
        resolvedAt: new Date().toISOString(),
        triageProposal: null,
      }),
    });

    return NextResponse.json({ promptId: queueItem.promptId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test test/app/api/feedback/approve-proposal.test.ts
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/improvement-queue-api.ts src/app/api/feedback/[id]/approve-proposal test/app/api/feedback/approve-proposal.test.ts
git commit -m "feat(hub): POST approve-proposal route → improvement queue + history log"
```

---

### Task 13: TDD — `DELETE /api/feedback/[id]/proposal` (reject)

**Files:**
- Create: `src/app/api/feedback/[id]/proposal/route.ts`
- Create: `test/app/api/feedback/reject-proposal.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// test/app/api/feedback/reject-proposal.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DELETE } from '@/app/api/feedback/[id]/proposal/route';
import * as triageApi from '@/lib/triage-api';
import * as feedbackApi from '@/lib/feedback-api';
import * as verifyAuth from '@/lib/verify-auth';

vi.mock('@/lib/triage-api');
vi.mock('@/lib/feedback-api');
vi.mock('@/lib/verify-auth');

describe('DELETE /api/feedback/[id]/proposal', () => {
  it('logs rejection with reason and marks session dismissed', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue({ email: 'steve@sevaro.com', isAdmin: true } as any);
    vi.mocked(feedbackApi.getSession).mockResolvedValue({
      sessionId: 'a3f2', appId: 'evidence-engine',
      triageProposal: { themeId: 'fonts-too-small', version: 1, revisions: [] },
    } as any);
    vi.mocked(triageApi.postTriageHistory).mockResolvedValue({} as any);

    const req = new Request('http://localhost/', {
      method: 'DELETE',
      headers: { cookie: 'id_token=valid' },
      body: JSON.stringify({ reason: 'low_priority', comment: 'not now', appId: 'evidence-engine' }),
    }) as any;
    const res = await DELETE(req, { params: { id: 'a3f2' } } as any);

    expect(res.status).toBe(200);
    expect(triageApi.postTriageHistory).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'a3f2',
      action: 'rejected',
      rejectionReason: 'low_priority',
      rejectionComment: 'not now',
    }));
  });

  it('rejects invalid reason', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue({ email: 'steve@sevaro.com', isAdmin: true } as any);
    const req = new Request('http://localhost/', {
      method: 'DELETE',
      headers: { cookie: 'id_token=valid' },
      body: JSON.stringify({ reason: 'bogus' }),
    }) as any;
    const res = await DELETE(req, { params: { id: 'a3f2' } } as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test test/app/api/feedback/reject-proposal.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/app/api/feedback/[id]/proposal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { postTriageHistory } from '@/lib/triage-api';

const VALID_REASONS = ['not_a_real_issue', 'already_fixed', 'low_priority', 'duplicate', 'out_of_scope', 'need_more_info'] as const;

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('id_token')?.value
    || req.headers.get('authorization')?.replace(/^Bearer /, '');
  const user = token ? await verifyToken(token) : null;
  return user?.isAdmin ? user : null;
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!VALID_REASONS.includes(body.reason)) {
    return NextResponse.json({ error: 'invalid reason' }, { status: 400 });
  }

  try {
    const session = await getSession(ctx.params.id, body.appId || '');
    const proposal = (session as any).triageProposal;
    if (!proposal) return NextResponse.json({ error: 'no triage proposal' }, { status: 404 });

    await postTriageHistory({
      sessionId: ctx.params.id,
      action: 'rejected',
      themeId: proposal.themeId,
      proposalSnapshot: proposal,
      rejectionReason: body.reason,
      rejectionComment: body.comment,
    });

    const FEEDBACK_API = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
    await fetch(`${FEEDBACK_API}/sessions/${ctx.params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FEEDBACK_API_KEY || '' },
      body: JSON.stringify({
        appId: session.appId,
        reviewStatus: 'dismissed',
        triageProposal: null,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run**

```bash
pnpm test test/app/api/feedback/reject-proposal.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feedback/[id]/proposal test/app/api/feedback/reject-proposal.test.ts
git commit -m "feat(hub): DELETE proposal route with structured rejection reasons"
```

---

### Task 14: TDD — `POST /api/feedback/[id]/refine-prompt`

**Files:**
- Create: `src/lib/bedrock-refine.ts`
- Create: `test/app/api/feedback/refine-prompt.test.ts`
- Create: `src/app/api/feedback/[id]/refine-prompt/route.ts`

- [ ] **Step 1: Create Bedrock wrapper**

```ts
// src/lib/bedrock-refine.ts
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-2' });
const MODEL_ID = 'us.anthropic.claude-sonnet-4-6';

export interface RefineInput {
  currentPrompt: string;
  refinementInstruction: string;
  sessionContext?: { classification?: string; excerpt?: string };
}

export interface RefineOutput {
  revisedPrompt: string;
  changeSummary: string;
}

const SYSTEM = `You are a prompt editor. The user will give you a draft Claude Code prompt and a natural-language instruction describing what to change. Rewrite the prompt to incorporate the instruction while:

- Preserving the original intent
- Not adding unrelated scope
- Not introducing new files or test requirements unless the instruction explicitly mentions them
- Keeping it as a standalone prompt a fresh Claude Code session can execute

Respond with ONLY a JSON object matching this shape: {"revisedPrompt": "<full rewritten prompt>", "changeSummary": "<one-sentence description of what changed>"}. No markdown fences, no preamble.`;

export async function refinePrompt(input: RefineInput): Promise<RefineOutput> {
  const userMsg = `CURRENT PROMPT:\n${input.currentPrompt}\n\nINSTRUCTION:\n${input.refinementInstruction}${input.sessionContext ? `\n\nSESSION CONTEXT:\nClassification: ${input.sessionContext.classification}\nFeedback excerpt: ${input.sessionContext.excerpt}` : ''}`;

  const res = await client.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM }],
    messages: [{ role: 'user', content: [{ text: userMsg }] }],
    inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
  }));

  const text = res.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('bedrock returned empty response');

  // Parse JSON, tolerant of leading/trailing whitespace but not markdown fences.
  let parsed: RefineOutput;
  try {
    parsed = JSON.parse(text.trim());
  } catch (err) {
    // Single fallback: strip ```json ... ``` if present, then re-parse. Fail loudly otherwise.
    const unfenced = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    try {
      parsed = JSON.parse(unfenced);
    } catch {
      throw new Error(`bedrock returned unparseable JSON: ${text.slice(0, 200)}`);
    }
  }

  if (typeof parsed.revisedPrompt !== 'string' || typeof parsed.changeSummary !== 'string') {
    throw new Error(`bedrock response missing required fields`);
  }
  return parsed;
}
```

- [ ] **Step 2: Write failing test**

```ts
// test/app/api/feedback/refine-prompt.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/feedback/[id]/refine-prompt/route';
import * as feedbackApi from '@/lib/feedback-api';
import * as bedrockRefine from '@/lib/bedrock-refine';
import * as verifyAuth from '@/lib/verify-auth';

vi.mock('@/lib/feedback-api');
vi.mock('@/lib/bedrock-refine');
vi.mock('@/lib/verify-auth');

describe('POST /api/feedback/[id]/refine-prompt', () => {
  it('appends a new revision and returns the rewritten prompt', async () => {
    vi.mocked(verifyAuth.verifyToken).mockResolvedValue({ email: 'steve@sevaro.com', isAdmin: true } as any);
    vi.mocked(feedbackApi.getSession).mockResolvedValue({
      sessionId: 'a3f2', appId: 'evidence-engine',
      triageProposal: {
        version: 1,
        themeId: 'fonts-too-small',
        revisions: [{ version: 1, prompt: 'original', instruction: null, createdAt: '2026-04-14T09:00:00Z' }],
      },
    } as any);
    vi.mocked(bedrockRefine.refinePrompt).mockResolvedValue({
      revisedPrompt: 'original + contrast check',
      changeSummary: 'added contrast check',
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;

    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { cookie: 'id_token=valid' },
      body: JSON.stringify({ instruction: 'also check contrast', appId: 'evidence-engine' }),
    }) as any;
    const res = await POST(req, { params: { id: 'a3f2' } } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.revision.version).toBe(2);
    expect(body.revision.prompt).toBe('original + contrast check');
    expect(body.revision.instruction).toBe('also check contrast');
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
pnpm test test/app/api/feedback/refine-prompt.test.ts
```

- [ ] **Step 4: Implement route**

```ts
// src/app/api/feedback/[id]/refine-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';
import { getSession } from '@/lib/feedback-api';
import { refinePrompt } from '@/lib/bedrock-refine';
import { postTriageHistory } from '@/lib/triage-api';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('id_token')?.value
    || req.headers.get('authorization')?.replace(/^Bearer /, '');
  const user = token ? await verifyToken(token) : null;
  return user?.isAdmin ? user : null;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.instruction || typeof body.instruction !== 'string') {
    return NextResponse.json({ error: 'instruction required' }, { status: 400 });
  }

  try {
    const session = await getSession(ctx.params.id, body.appId || '');
    const proposal = (session as any).triageProposal;
    if (!proposal) return NextResponse.json({ error: 'no proposal' }, { status: 404 });

    const current = proposal.revisions[proposal.revisions.length - 1];
    const refined = await refinePrompt({
      currentPrompt: current.prompt,
      refinementInstruction: body.instruction,
      sessionContext: { classification: proposal.classification, excerpt: (session as any).transcript?.slice(0, 500) },
    });

    const newRevision = {
      version: current.version + 1,
      prompt: refined.revisedPrompt,
      instruction: body.instruction,
      createdAt: new Date().toISOString(),
    };
    const updatedProposal = { ...proposal, revisions: [...proposal.revisions, newRevision] };

    // Patch the session with the updated proposal
    const FEEDBACK_API = process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback';
    await fetch(`${FEEDBACK_API}/sessions/${ctx.params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FEEDBACK_API_KEY || '' },
      body: JSON.stringify({ appId: session.appId, triageProposal: updatedProposal }),
    });

    await postTriageHistory({
      sessionId: ctx.params.id,
      action: 'refined',
      themeId: proposal.themeId,
      proposalSnapshot: updatedProposal,
      reviewerNotes: body.instruction,
    });

    return NextResponse.json({ revision: newRevision, changeSummary: refined.changeSummary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test test/app/api/feedback/refine-prompt.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/bedrock-refine.ts src/app/api/feedback/[id]/refine-prompt test/app/api/feedback/refine-prompt.test.ts
git commit -m "feat(hub): POST refine-prompt with Bedrock rewrite and revision log"
```

Phase 2 complete: all Hub API routes exist, pass unit tests, and proxy to the Lambda from Phase 1.

---

## Phase 3 — `/triage-feedback` skill

**Working directory:** `~/.claude/skills/triage-feedback/` (create fresh)

### Task 15: Scaffold the skill directory

**Files:**
- Create: `~/.claude/skills/triage-feedback/SKILL.md`
- Create: `~/.claude/skills/triage-feedback/package.json`
- Create: `~/.claude/skills/triage-feedback/tsconfig.json`
- Create: `~/.claude/skills/triage-feedback/scripts/hub-client.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p ~/.claude/skills/triage-feedback/scripts
cd ~/.claude/skills/triage-feedback
```

- [ ] **Step 2: Create `SKILL.md`**

```markdown
---
name: triage-feedback
description: Use when the user says /triage-feedback, triage feedback, or wants to run feedback triage. Fetches unreviewed feedback sessions from sevaro-hub, classifies them with Bedrock Sonnet 4.6, maps each to suspected code in the local Sevaro repos, drafts a Claude Code fix prompt, and writes proposals back for human review at hub.neuroplans.app/feedback/triage.
---

# Triage Feedback

## When to use

- User says `/triage-feedback`, "triage feedback", "run feedback triage", or similar
- User clicks the "Run Triage on these N now" button in the Hub (creates a triage-request that this skill picks up)

## Prerequisites

- Must be invoked from `~/dev/repos/` (for local repo grep access)
- Environment variables required:
  - `HUB_ADMIN_TOKEN` — Cognito id_token for steve@sevaro.com (or equivalent admin user)
  - `FEEDBACK_API_KEY` — x-api-key for the feedback API
  - `AWS_PROFILE=sevaro-sandbox` (for Bedrock)

## Flow

1. Run `pnpm install` in this skill directory if node_modules missing
2. Run `pnpm tsx scripts/triage.ts` — the main entry
3. The script:
   - Checks `GET /api/feedback/triage-requests?status=pending` on the Hub
   - If pending requests exist, processes only those session IDs and marks each request `processing` then `done`
   - Otherwise, processes all sessions with `reviewStatus=open` and no `triageProposal`
   - Fetches the existing theme menu via `GET /api/feedback/themes`
   - For each session: calls Bedrock with structured output, greps the suspected repo for files, PATCHes the session with the proposal, logs to history
   - Prints a summary table

## Safety

- **Never write to the improvement queue directly.** This skill only writes proposals to sessions; approval lives in the Hub UI.
- **Strip PHI.** Before sending any session data to Bedrock, drop `encounterId` and `patientLabel` fields.
- **Low confidence flag.** Any proposal with confidence < 0.6 is marked in the UI — but we still write it; the human decides.
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "triage-feedback-skill",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "triage": "tsx scripts/triage.ts",
    "smoke": "bash scripts/smoke-test.sh"
  },
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.1009.0",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["scripts/**/*.ts"]
}
```

- [ ] **Step 5: Install**

```bash
pnpm install
```

- [ ] **Step 6: Commit (in ~/.claude/skills repo if versioned; otherwise note)**

```bash
cd ~/.claude/skills
git add triage-feedback 2>/dev/null && git commit -m "feat: add triage-feedback skill scaffold" || echo "~/.claude/skills not a git repo — skill files are loose"
```

---

### Task 16: Implement the skill's main triage flow

**Files:**
- Create: `~/.claude/skills/triage-feedback/scripts/hub-client.ts`
- Create: `~/.claude/skills/triage-feedback/scripts/bedrock-client.ts`
- Create: `~/.claude/skills/triage-feedback/scripts/grep-repo.ts`
- Create: `~/.claude/skills/triage-feedback/scripts/triage.ts`

- [ ] **Step 1: Create `scripts/hub-client.ts`**

```ts
const HUB_BASE = process.env.HUB_BASE_URL || 'https://hub.neuroplans.app';
const TOKEN = process.env.HUB_ADMIN_TOKEN || '';

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
  'Cookie': `id_token=${TOKEN}`,
});

export async function getOpenSessions() {
  const res = await fetch(`${HUB_BASE}/api/feedback/sessions?reviewStatus=open`, { headers: headers() });
  if (!res.ok) throw new Error(`sessions GET ${res.status}`);
  return (await res.json()).sessions || [];
}

export async function getPendingTriageRequests() {
  const res = await fetch(`${HUB_BASE}/api/feedback/triage-requests?status=pending`, { headers: headers() });
  if (!res.ok) throw new Error(`triage-requests GET ${res.status}`);
  return (await res.json()).requests || [];
}

export async function patchTriageRequest(id: string, updates: { status: string; processedCount?: number }) {
  const res = await fetch(`${HUB_BASE}/api/feedback/triage-requests/${id}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`triage-requests PATCH ${res.status}`);
}

export async function getThemes() {
  const res = await fetch(`${HUB_BASE}/api/feedback/themes`, { headers: headers() });
  if (!res.ok) throw new Error(`themes GET ${res.status}`);
  return (await res.json()).themes || [];
}

export async function patchSession(sessionId: string, appId: string, updates: Record<string, unknown>) {
  const res = await fetch(`${HUB_BASE}/api/feedback/${sessionId}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ appId, ...updates }),
  });
  if (!res.ok) throw new Error(`session PATCH ${res.status}`);
}

export async function postHistory(entry: unknown) {
  const res = await fetch(`${HUB_BASE}/api/feedback/triage-history`, {
    method: 'POST', headers: headers(), body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`history POST ${res.status}`);
}
```

- [ ] **Step 2: Create `scripts/bedrock-client.ts`**

```ts
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-2' });
const MODEL_ID = 'us.anthropic.claude-sonnet-4-6';

const SYSTEM = `You are a feedback triage agent. Given a user's feedback session and an existing theme menu, classify the session and draft a Claude Code prompt that fixes the reported issue.

Respond with ONLY a JSON object matching this shape:
{
  "classification": "real_bug" | "confused_user" | "duplicate" | "out_of_scope" | "needs_info",
  "confidence": <number 0-1>,
  "themeId": "<slug, pick from menu or propose a new one>",
  "themeDescription": "<short human-readable description>",
  "suspectedRepo": "<exact repo name like sevaro-evidence-engine, or null>",
  "suspectedFiles": [{ "path": "<relative path>", "reason": "<why you think this file>" }],
  "rationale": "<1-2 sentences explaining your classification>",
  "draftPrompt": "<a full Claude Code prompt a fresh session can execute>"
}

No markdown fences, no preamble.`;

export interface ClassifyInput {
  session: { transcript?: string; excerpt?: string; userAgent?: string; category?: string; rating?: number; appId: string };
  existingThemes: Array<{ themeId: string; description: string; count: number }>;
}

export interface ClassifyOutput {
  classification: 'real_bug' | 'confused_user' | 'duplicate' | 'out_of_scope' | 'needs_info';
  confidence: number;
  themeId: string;
  themeDescription: string;
  suspectedRepo: string | null;
  suspectedFiles: Array<{ path: string; reason: string }>;
  rationale: string;
  draftPrompt: string;
}

export async function classifySession(input: ClassifyInput): Promise<ClassifyOutput> {
  const themeMenu = input.existingThemes.map((t) => `- ${t.themeId}: ${t.description} (${t.count} prior sessions)`).join('\n') || '(no existing themes)';
  const userMsg = `EXISTING THEMES:\n${themeMenu}\n\nSESSION:\nApp: ${input.session.appId}\nCategory: ${input.session.category || 'unknown'}\nRating: ${input.session.rating ?? 'n/a'}\nUser Agent: ${input.session.userAgent || 'unknown'}\nExcerpt: ${input.session.excerpt || input.session.transcript || '(none)'}`;

  const res = await client.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM }],
    messages: [{ role: 'user', content: [{ text: userMsg }] }],
    inferenceConfig: { maxTokens: 3000, temperature: 0.2 },
  }));

  const text = res.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('empty bedrock response');

  let parsed: ClassifyOutput;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    const unfenced = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    parsed = JSON.parse(unfenced);
  }
  // Validate required fields
  const required = ['classification', 'confidence', 'themeId', 'suspectedFiles', 'draftPrompt'];
  for (const k of required) {
    if (!(k in parsed)) throw new Error(`bedrock missing field: ${k}`);
  }
  return parsed;
}
```

- [ ] **Step 3: Create `scripts/grep-repo.ts`**

```ts
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPOS_ROOT = process.env.REPOS_ROOT || `${process.env.HOME}/dev/repos`;

export interface GrepHit {
  path: string;
  line: number;
  excerpt: string;
}

export function locateFiles(repoName: string, suspectedFiles: Array<{ path: string }>): GrepHit[] {
  const repoPath = resolve(REPOS_ROOT, repoName);
  if (!existsSync(repoPath)) return [];

  const hits: GrepHit[] = [];
  for (const file of suspectedFiles) {
    // Strategy 1: exact path under repo
    const exact = join(repoPath, file.path);
    if (existsSync(exact)) {
      try {
        const content = readFileSync(exact, 'utf8');
        const lines = content.split('\n');
        // Return first 20 lines as excerpt (or the whole thing if shorter)
        hits.push({
          path: file.path,
          line: 1,
          excerpt: lines.slice(0, 20).join('\n'),
        });
        continue;
      } catch {}
    }
    // Strategy 2: glob search by basename
    const basename = file.path.split('/').pop() || file.path;
    const result = spawnSync('rg', ['--files', '-g', `**/${basename}`, repoPath], { encoding: 'utf8' });
    const found = result.stdout.trim().split('\n').filter(Boolean);
    if (found.length > 0 && found[0]) {
      try {
        const content = readFileSync(found[0], 'utf8');
        const lines = content.split('\n').slice(0, 20).join('\n');
        hits.push({ path: found[0].replace(`${repoPath}/`, ''), line: 1, excerpt: lines });
      } catch {}
    }
  }
  return hits;
}
```

- [ ] **Step 4: Create `scripts/triage.ts` — main entry**

```ts
#!/usr/bin/env tsx
import { getOpenSessions, getPendingTriageRequests, patchTriageRequest, getThemes, patchSession, postHistory } from './hub-client.ts';
import { classifySession } from './bedrock-client.ts';
import { locateFiles } from './grep-repo.ts';

function stripPHI(session: any) {
  const { encounterId, patientLabel, ...rest } = session;
  return rest;
}

async function main() {
  console.log('Fetching pending triage requests...');
  const pendingReqs = await getPendingTriageRequests();
  console.log(`Found ${pendingReqs.length} pending requests`);

  console.log('Fetching existing themes...');
  const themes = await getThemes();
  console.log(`Found ${themes.length} existing themes`);

  let sessionsToProcess: any[];
  let reqsBeingProcessed: any[] = [];

  if (pendingReqs.length > 0) {
    // Explicit trigger: process union of requested session IDs
    const targetIds = new Set<string>();
    for (const r of pendingReqs) {
      r.sessionIds?.forEach((id: string) => targetIds.add(id));
      await patchTriageRequest(r.requestId, { status: 'processing' });
    }
    reqsBeingProcessed = pendingReqs;
    const allOpen = await getOpenSessions();
    sessionsToProcess = allOpen.filter((s: any) => targetIds.has(s.sessionId));
    console.log(`Explicit trigger: processing ${sessionsToProcess.length} sessions from ${pendingReqs.length} requests`);
  } else {
    // Fall back to all untriaged open sessions
    const allOpen = await getOpenSessions();
    sessionsToProcess = allOpen.filter((s: any) => !s.triageProposal);
    console.log(`No pending requests — processing ${sessionsToProcess.length} untriaged open sessions`);
  }

  let proposed = 0;
  const themesTouched = new Set<string>();
  const newThemes = new Set<string>();

  for (const session of sessionsToProcess) {
    try {
      console.log(`\n→ Session ${session.sessionId} (${session.appId})`);
      const cleanSession = stripPHI(session);

      const classified = await classifySession({
        session: {
          transcript: cleanSession.transcript,
          excerpt: cleanSession.transcript?.slice(0, 1000),
          userAgent: cleanSession.userAgent,
          category: cleanSession.category,
          rating: cleanSession.rating,
          appId: cleanSession.appId,
        },
        existingThemes: themes,
      });

      console.log(`  → ${classified.classification} (${classified.confidence}) · theme: ${classified.themeId}`);
      themesTouched.add(classified.themeId);
      if (!themes.find((t: any) => t.themeId === classified.themeId)) newThemes.add(classified.themeId);

      // Grep locally for suspected files
      const hits = classified.suspectedRepo
        ? locateFiles(classified.suspectedRepo, classified.suspectedFiles)
        : [];

      const proposal = {
        version: 1,
        createdAt: new Date().toISOString(),
        classification: classified.classification,
        confidence: classified.confidence,
        themeId: classified.themeId,
        themeDescription: classified.themeDescription,
        suspectedRepo: classified.suspectedRepo,
        suspectedFiles: hits.length > 0 ? hits : classified.suspectedFiles.map((f) => ({ path: f.path, line: 0, excerpt: f.reason })),
        rationale: classified.rationale,
        revisions: [{
          version: 1,
          prompt: classified.draftPrompt,
          instruction: null,
          createdAt: new Date().toISOString(),
        }],
      };

      await patchSession(session.sessionId, session.appId, { triageProposal: proposal });
      await postHistory({
        sessionId: session.sessionId,
        action: 'proposed',
        themeId: classified.themeId,
        proposalSnapshot: proposal,
      });
      proposed += 1;
    } catch (err: any) {
      console.error(`  ✗ failed: ${err.message}`);
    }
  }

  // Mark requests done
  for (const r of reqsBeingProcessed) {
    await patchTriageRequest(r.requestId, { status: 'done', processedCount: proposed });
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Sessions processed: ${sessionsToProcess.length}`);
  console.log(`Proposals written: ${proposed}`);
  console.log(`Themes touched: ${themesTouched.size} (${themesTouched.size - newThemes.size} existing, ${newThemes.size} new)`);
  if (reqsBeingProcessed.length > 0) {
    console.log(`Triage requests completed: ${reqsBeingProcessed.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Smoke-run it against staging (tolerate no sessions)**

```bash
export HUB_BASE_URL=https://hub.neuroplans.app
export HUB_ADMIN_TOKEN="<your id_token cookie value>"
export AWS_PROFILE=sevaro-sandbox
pnpm triage
```

Expected: prints "No pending requests — processing N untriaged open sessions" and runs without crashing. May produce proposals.

- [ ] **Step 6: Commit**

```bash
cd ~/.claude/skills && git add triage-feedback/ 2>/dev/null && git commit -m "feat: triage-feedback skill main flow"
```

---

### Task 17: Add smoke-test script for the skill

**Files:**
- Create: `~/.claude/skills/triage-feedback/scripts/smoke-test.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${HUB_BASE_URL:?must set HUB_BASE_URL}"
: "${HUB_ADMIN_TOKEN:?must set HUB_ADMIN_TOKEN}"

echo "Smoke test: themes endpoint..."
curl -sf "$HUB_BASE_URL/api/feedback/themes" -b "id_token=$HUB_ADMIN_TOKEN" | head -c 200
echo

echo "Smoke test: pending triage requests..."
curl -sf "$HUB_BASE_URL/api/feedback/triage-requests?status=pending" -b "id_token=$HUB_ADMIN_TOKEN" | head -c 200
echo

echo "OK"
```

- [ ] **Step 2: Make executable and run**

```bash
chmod +x scripts/smoke-test.sh
HUB_BASE_URL=https://hub.neuroplans.app HUB_ADMIN_TOKEN="<token>" pnpm smoke
```

Expected: `OK` with sample JSON above.

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/skills && git add triage-feedback/scripts/smoke-test.sh 2>/dev/null && git commit -m "test: smoke-test script for triage-feedback skill"
```

Phase 3 complete: skill exists, runs end-to-end against staging Lambda + Hub.

---

## Phase 4 — `/feedback/triage` Hub UI

**Working directory:** `sevaro-hub/.claude/worktrees/feedback-triage`

### Task 18: Scaffold `/feedback/triage` page with server-side data load

**Files:**
- Create: `src/app/feedback/triage/page.tsx`
- Create: `src/app/feedback/triage/TriageClient.tsx`
- Modify: `src/lib/feedback-api.ts` (add `triageProposal` to FeedbackSession type)

- [ ] **Step 1: Extend the session type**

In `src/lib/feedback-api.ts`, add to the `FeedbackSession` interface:

```ts
export interface TriageProposal {
  version: number;
  createdAt: string;
  classification: 'real_bug' | 'confused_user' | 'duplicate' | 'out_of_scope' | 'needs_info';
  confidence: number;
  themeId: string;
  themeDescription: string;
  suspectedRepo: string | null;
  suspectedFiles: Array<{ path: string; line: number; excerpt: string }>;
  rationale: string;
  revisions: Array<{ version: number; prompt: string; instruction: string | null; createdAt: string }>;
}

export interface FeedbackSession {
  // ... existing fields
  triageProposal?: TriageProposal | null;
}
```

- [ ] **Step 2: Create server component page**

```tsx
// src/app/feedback/triage/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/verify-auth';
import { listSessions } from '@/lib/feedback-api';
import { TriageClient } from './TriageClient';

export default async function TriagePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('id_token')?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user?.isAdmin) redirect('/login?next=/feedback/triage');

  const allSessions = await listSessions();
  const withProposals = allSessions.filter((s) => s.triageProposal);

  return <TriageClient initialSessions={withProposals} />;
}
```

- [ ] **Step 3: Create client scaffold**

```tsx
// src/app/feedback/triage/TriageClient.tsx
'use client';
import { useState } from 'react';
import type { FeedbackSession } from '@/lib/feedback-api';

export function TriageClient({ initialSessions }: { initialSessions: FeedbackSession[] }) {
  const [sessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.sessionId || null);
  const selected = sessions.find((s) => s.sessionId === selectedId);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif" }}>
      <div style={{ flex: '0 0 340px', borderRight: '1px solid #dedede', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #dedede', fontWeight: 600 }}>
          Triage Queue · {sessions.length}
        </div>
        {sessions.map((s) => (
          <button
            key={s.sessionId}
            onClick={() => setSelectedId(s.sessionId)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '12px 16px', border: 'none',
              background: selectedId === s.sessionId ? '#f4f4f4' : '#fff',
              borderLeft: `3px solid ${s.triageProposal?.classification === 'real_bug' ? '#22c55e' : s.triageProposal?.classification === 'needs_info' ? '#eab308' : '#acacaf'}`,
              cursor: 'pointer', borderBottom: '1px solid #f1f1f1',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>#{s.sessionId.slice(0, 4)} · {s.appId}</div>
            <div style={{ fontSize: 11, color: '#696a70', marginTop: 4 }}>{(s.transcript || '').slice(0, 80)}</div>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selected ? <div style={{ padding: 24 }}>Detail pane for #{selected.sessionId} — wired in Task 19</div> : <div style={{ padding: 24 }}>Select a session</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run dev server, visit /feedback/triage**

```bash
pnpm dev
```

Browse to `http://localhost:3000/feedback/triage` with a valid admin cookie. Expected: page loads, shows empty or populated list depending on DynamoDB state.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedback-api.ts src/app/feedback/triage
git commit -m "feat(hub): scaffold /feedback/triage page with list pane"
```

---

### Task 19: Build detail pane components

**Files:**
- Create: `src/app/feedback/triage/ProposalDetail.tsx`
- Create: `test/app/feedback/triage/ProposalDetail.test.tsx`
- Modify: `src/app/feedback/triage/TriageClient.tsx`

- [ ] **Step 1: Write failing component test**

```tsx
// test/app/feedback/triage/ProposalDetail.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProposalDetail } from '@/app/feedback/triage/ProposalDetail';

const mockSession = {
  sessionId: 'a3f2',
  appId: 'evidence-engine',
  category: 'bug report',
  transcript: 'Dosing card text is tiny',
  triageProposal: {
    version: 1, createdAt: '2026-04-14T09:00:00Z',
    classification: 'real_bug' as const, confidence: 0.92,
    themeId: 'fonts-too-small', themeDescription: 'Font too small',
    suspectedRepo: 'sevaro-evidence-engine',
    suspectedFiles: [{ path: 'components/DosingCard.tsx', line: 42, excerpt: '<span className="text-sm"...' }],
    rationale: 'User explicitly complained about readability',
    revisions: [{ version: 1, prompt: 'Bump font to 16px', instruction: null, createdAt: '2026-04-14T09:00:00Z' }],
  },
} as any;

describe('ProposalDetail', () => {
  it('renders the classification, confidence, theme, and current prompt', () => {
    render(<ProposalDetail session={mockSession} onApprove={() => {}} onReject={() => {}} onRefine={async () => {}} />);
    expect(screen.getByText(/real bug/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.92/)).toBeInTheDocument();
    expect(screen.getByText(/fonts-too-small/)).toBeInTheDocument();
    expect(screen.getByText(/Bump font to 16px/)).toBeInTheDocument();
    expect(screen.getByText(/components\/DosingCard\.tsx/)).toBeInTheDocument();
  });

  it('shows "revision N of M" when revisions count > 1', () => {
    const multi = {
      ...mockSession,
      triageProposal: {
        ...mockSession.triageProposal,
        revisions: [
          { version: 1, prompt: 'v1', instruction: null, createdAt: '2026-04-14T09:00:00Z' },
          { version: 2, prompt: 'v2', instruction: 'also check contrast', createdAt: '2026-04-14T09:05:00Z' },
        ],
      },
    };
    render(<ProposalDetail session={multi} onApprove={() => {}} onReject={() => {}} onRefine={async () => {}} />);
    expect(screen.getByText(/revision 2 of 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test test/app/feedback/triage/ProposalDetail.test.tsx
```

- [ ] **Step 3: Implement `ProposalDetail.tsx`**

```tsx
// src/app/feedback/triage/ProposalDetail.tsx
'use client';
import { useState } from 'react';
import type { FeedbackSession } from '@/lib/feedback-api';

interface Props {
  session: FeedbackSession;
  onApprove: (notes?: string) => void;
  onReject: (reason: string, comment?: string) => void;
  onRefine: (instruction: string) => Promise<void>;
}

export function ProposalDetail({ session, onApprove, onReject, onRefine }: Props) {
  const proposal = session.triageProposal!;
  const current = proposal.revisions[proposal.revisions.length - 1];
  const [refinementInput, setRefinementInput] = useState('');
  const [refining, setRefining] = useState(false);

  const classificationLabel = proposal.classification.replace(/_/g, ' ');
  const confidencePct = Math.round(proposal.confidence * 100);

  return (
    <div style={{ padding: '20px 24px', paddingBottom: 96, position: 'relative', minHeight: '100vh' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>#{session.sessionId.slice(0, 6)} · {session.appId}</div>
      <div style={{ fontSize: 13, color: '#696a70', marginBottom: 16 }}>{session.category}</div>

      {proposal.revisions.length > 1 && (
        <div style={{ background: '#bfd7fe', color: '#1e478a', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block', marginBottom: 12 }}>
          revision {current.version} of {proposal.revisions.length}
        </div>
      )}

      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#696a70', fontWeight: 600, marginBottom: 6 }}>Feedback excerpt</div>
      <div style={{ background: '#f9f9f9', borderLeft: '3px solid #dedede', padding: '10px 14px', fontSize: 13, color: '#54565c', fontStyle: 'italic', marginBottom: 18 }}>
        {session.transcript?.slice(0, 500) || '(no transcript)'}
      </div>

      <div style={{ border: '1px solid #dedede', borderRadius: 8, padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Agent classification</div>
          <div style={{ fontSize: 11 }}>Confidence: {confidencePct}%</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <span style={{ background: '#bbf7d1', color: '#14532b', fontSize: 11, padding: '3px 9px', borderRadius: 12, fontWeight: 500 }}>{classificationLabel}</span>
          <span style={{ background: '#e2d6fe', color: '#421d95', fontSize: 11, padding: '3px 9px', borderRadius: 12 }}>{proposal.themeId}</span>
        </div>
        <div style={{ fontSize: 12, color: '#54565c' }}>{proposal.rationale}</div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#696a70', fontWeight: 600, marginBottom: 6 }}>Suggested files</div>
        <div style={{ background: '#f9f9f9', border: '1px solid #dedede', borderRadius: 6, padding: 10, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 }}>
          {proposal.suspectedFiles.map((f, i) => (
            <div key={i}>
              <div>{proposal.suspectedRepo}/{f.path}{f.line ? `:L${f.line}` : ''}</div>
              <div style={{ color: '#696a70', paddingLeft: 14, fontSize: 10 }}>{f.excerpt}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#696a70', fontWeight: 600, marginBottom: 6 }}>Draft Claude Code prompt</div>
        <div style={{ background: '#0c0f14', color: '#f1f1f1', borderRadius: 6, padding: 14, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {current.prompt}
        </div>
      </div>

      <div style={{ marginBottom: 16, background: '#f9f9f9', border: '1px solid #dedede', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#696a70', fontWeight: 600, marginBottom: 6 }}>Refine with instructions</div>
        <textarea
          value={refinementInput}
          onChange={(e) => setRefinementInput(e.target.value)}
          placeholder='e.g. "make it shorter", "also check contrast", "don&apos;t touch the component file"'
          style={{ width: '100%', minHeight: 44, padding: 9, border: '1px solid #dedede', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }}
        />
        <button
          disabled={refining || !refinementInput.trim()}
          onClick={async () => {
            setRefining(true);
            try {
              await onRefine(refinementInput);
              setRefinementInput('');
            } finally {
              setRefining(false);
            }
          }}
          style={{ marginTop: 6, background: '#0c0f14', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >
          {refining ? 'Rewriting…' : 'Rewrite ↵'}
        </button>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #dedede', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={() => { const reason = prompt('Rejection reason (not_a_real_issue, already_fixed, low_priority, duplicate, out_of_scope, need_more_info):') || 'low_priority'; onReject(reason); }} style={{ background: '#fff', border: '1px solid #dedede', padding: '8px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Reject…</button>
        <button onClick={() => onApprove()} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Approve →</button>
      </div>
    </div>
  );
}
```

Note: the reject button uses `window.prompt` as a v1 stub. Task 20 replaces this with a proper modal.

- [ ] **Step 4: Wire into `TriageClient.tsx`**

Replace the placeholder in the right pane with `<ProposalDetail>`. The client component will call three handlers that POST to the Hub API routes created in Phase 2.

```tsx
// Add to TriageClient.tsx imports:
import { ProposalDetail } from './ProposalDetail';
import { useRouter } from 'next/navigation';

// In TriageClient:
const router = useRouter();

async function handleApprove(sessionId: string, appId: string, notes?: string) {
  const res = await fetch(`/api/feedback/${sessionId}/approve-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, reviewerNotes: notes }),
  });
  if (!res.ok) { alert(`Approve failed: ${await res.text()}`); return; }
  router.refresh();
}

async function handleReject(sessionId: string, appId: string, reason: string, comment?: string) {
  const res = await fetch(`/api/feedback/${sessionId}/proposal`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, reason, comment }),
  });
  if (!res.ok) { alert(`Reject failed: ${await res.text()}`); return; }
  router.refresh();
}

async function handleRefine(sessionId: string, appId: string, instruction: string) {
  const res = await fetch(`/api/feedback/${sessionId}/refine-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, instruction }),
  });
  if (!res.ok) { alert(`Refine failed: ${await res.text()}`); return; }
  router.refresh();
}

// In the JSX, replace the placeholder with:
{selected ? (
  <ProposalDetail
    session={selected}
    onApprove={(notes) => handleApprove(selected.sessionId, selected.appId, notes)}
    onReject={(reason, comment) => handleReject(selected.sessionId, selected.appId, reason, comment)}
    onRefine={async (instruction) => handleRefine(selected.sessionId, selected.appId, instruction)}
  />
) : ...}
```

- [ ] **Step 5: Run component test**

```bash
pnpm test test/app/feedback/triage/ProposalDetail.test.tsx
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/feedback/triage/ProposalDetail.tsx src/app/feedback/triage/TriageClient.tsx test/app/feedback/triage/ProposalDetail.test.tsx
git commit -m "feat(hub): ProposalDetail component with refine panel and action handlers"
```

---

### Task 19b: Polish pass — confidence flag, keyboard nav, diff toggle, theme link

**Files:**
- Modify: `src/app/feedback/triage/ProposalDetail.tsx`
- Modify: `src/app/feedback/triage/TriageClient.tsx`

These are the four spec requirements that didn't fit cleanly into Task 19's core scaffold. Each is small; they're grouped because they all live in the same two files.

- [ ] **Step 1: Confidence `< 0.6` visual flag in `ProposalDetail.tsx`**

At the top of the component, just below the existing `confidencePct` calc:

```tsx
const lowConfidence = proposal.confidence < 0.6;
```

On the outer wrapping `<div>` of the classification card (the one with `border: '1px solid #dedede'`), conditionally tint the border:

```tsx
<div style={{
  border: lowConfidence ? '1px solid #fecaca' : '1px solid #dedede',
  boxShadow: lowConfidence ? '0 0 0 2px #fecaca40' : 'none',
  borderRadius: 8, padding: 14, marginBottom: 18,
}}>
```

And inside the card's header row, next to the confidence percent, add a warning chip when low:

```tsx
{lowConfidence && (
  <span style={{ background: '#fecaca', color: '#7f1d1d', fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 500, marginLeft: 6 }}>
    ⚠ low confidence
  </span>
)}
```

- [ ] **Step 2: Clickable theme chip → link to analyze filtered by theme**

Replace the theme chip `<span>` in `ProposalDetail.tsx` with an anchor:

```tsx
<a
  href={`/feedback/analyze?theme=${encodeURIComponent(proposal.themeId)}`}
  style={{ background: '#e2d6fe', color: '#421d95', fontSize: 11, padding: '3px 9px', borderRadius: 12, textDecoration: 'none' }}
>
  {proposal.themeId}
</a>
```

For v1 this links to the analyze page; the analyze page ignores the `?theme=` query param for v1 (a follow-up can make the analyze page scroll-to and highlight the matching theme card).

- [ ] **Step 3: Diff toggle for the dark prompt code block**

Add state at the top of `ProposalDetail`:

```tsx
const [showDiff, setShowDiff] = useState(false);
const previous = proposal.revisions.length >= 2
  ? proposal.revisions[proposal.revisions.length - 2]
  : null;
```

Between the "Draft Claude Code prompt" label and the dark code block, add a toggle button (only visible when there's a previous revision):

```tsx
{previous && (
  <button
    onClick={() => setShowDiff(!showDiff)}
    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 11, cursor: 'pointer', float: 'right' }}
  >
    {showDiff ? 'Hide diff' : 'Show diff from previous'}
  </button>
)}
```

Replace the current prompt rendering with a diff-aware version. Simple line-level diff: highlight lines in the current prompt that aren't in the previous:

```tsx
function renderPromptWithOptionalDiff(current: string, prev: string | null, showDiff: boolean) {
  if (!showDiff || !prev) {
    return <>{current}</>;
  }
  const prevLines = new Set(prev.split('\n').map((l) => l.trim()));
  return (
    <>
      {current.split('\n').map((line, i) => {
        const isNew = !prevLines.has(line.trim()) && line.trim() !== '';
        return (
          <div key={i} style={isNew ? { background: '#14532b', color: '#bbf7d1', padding: '1px 4px', borderRadius: 2 } : undefined}>
            {line || '\u00A0'}
          </div>
        );
      })}
    </>
  );
}
```

Use it in the code block:

```tsx
<div style={{ background: '#0c0f14', color: '#f1f1f1', ... }}>
  {renderPromptWithOptionalDiff(current.prompt, previous?.prompt || null, showDiff)}
</div>
```

Note: this is a naive line-level diff (exact match). Good enough for v1 when most revisions add or remove whole lines. A real diff (word/char level) is a follow-up.

- [ ] **Step 4: Keyboard shortcuts in `TriageClient.tsx`**

Add a `useEffect` that binds keyboard events while the component is mounted:

```tsx
import { useEffect, useState } from 'react';

// Inside TriageClient:
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    // Ignore if focus is inside an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowDown') {
      const idx = sessions.findIndex((s) => s.sessionId === selectedId);
      const next = sessions[Math.min(sessions.length - 1, idx + 1)];
      if (next) setSelectedId(next.sessionId);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      const idx = sessions.findIndex((s) => s.sessionId === selectedId);
      const prev = sessions[Math.max(0, idx - 1)];
      if (prev) setSelectedId(prev.sessionId);
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'a' && selected) {
      handleApprove(selected.sessionId, selected.appId);
    } else if (e.key.toLowerCase() === 'r' && selected) {
      setRejectOpen(true); // State added in Task 20
    }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [sessions, selectedId, selected]);
```

Note: Task 20 will add `rejectOpen` state for the modal. If you're executing this task before Task 20, temporarily guard the `r` handler with a comment: `// TODO: wire to reject modal in Task 20`. Actually — just execute Task 20 first if the dependency feels off; the order is flexible within a phase.

- [ ] **Step 5: Smoke test the polish items in dev**

```bash
pnpm dev
```

In the browser at `/feedback/triage`:
1. Verify a low-confidence proposal (seed one with `confidence: 0.5`) shows the red border + low-confidence chip
2. Press ↑ and ↓ — confirm the selected session row changes
3. Click a theme chip — confirm it navigates to `/feedback/analyze?theme=...`
4. For a session with 2+ revisions, click "Show diff from previous" — confirm the added lines highlight green

- [ ] **Step 6: Commit**

```bash
git add src/app/feedback/triage
git commit -m "feat(hub): triage polish — confidence flag, keyboard nav, diff toggle, theme link"
```

---

### Task 20: Reject modal + Run Triage button

**Files:**
- Create: `src/app/feedback/triage/RejectModal.tsx`
- Modify: `src/app/feedback/triage/TriageClient.tsx`
- Modify: `src/app/feedback/triage/ProposalDetail.tsx`

- [ ] **Step 1: Create `RejectModal.tsx`**

```tsx
// src/app/feedback/triage/RejectModal.tsx
'use client';
import { useState } from 'react';

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'not_a_real_issue', label: 'Not a real issue' },
  { value: 'already_fixed', label: 'Already fixed' },
  { value: 'low_priority', label: 'Low priority' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'out_of_scope', label: 'Out of scope' },
  { value: 'need_more_info', label: 'Need more info' },
];

interface Props {
  onConfirm: (reason: string, comment?: string) => void;
  onCancel: () => void;
}

export function RejectModal({ onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState(REASONS[0].value);
  const [comment, setComment] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, fontFamily: "-apple-system, sans-serif" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Why reject this proposal?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {REASONS.map((r) => (
            <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment (feeds theme-level re-surfacing)"
          style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #dedede', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '8px 14px', border: '1px solid #dedede', background: '#fff', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(reason, comment || undefined)} style={{ padding: '8px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Confirm reject</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire modal into TriageClient**

In `TriageClient.tsx`, add state for the modal, render it conditionally, wire up confirm/cancel to the existing `handleReject`. Replace the `window.prompt` stub in `ProposalDetail` by having the reject button call a parent callback that opens the modal.

Change `ProposalDetail` props from `onReject: (reason, comment)` to `onRejectClick: () => void` so the parent controls the modal state.

- [ ] **Step 3: Add Run Triage button to top toolbar**

In `TriageClient.tsx`, add a top toolbar with the button:

```tsx
<div style={{ padding: '14px 24px', borderBottom: '1px solid #dedede', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
  <div style={{ fontSize: 18, fontWeight: 600 }}>Triage Queue</div>
  <button
    onClick={handleRunTriage}
    style={{ background: '#0c0f14', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
  >⟳ Run Triage on these {sessions.filter((s) => !s.triageProposal).length} now</button>
</div>

// handler:
async function handleRunTriage() {
  const openIds = sessions.filter((s) => !s.triageProposal).map((s) => s.sessionId);
  if (openIds.length === 0) { alert('No untriaged sessions'); return; }
  const res = await fetch('/api/feedback/triage-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionIds: openIds }),
  });
  if (!res.ok) { alert('Failed'); return; }
  alert('Triage queued. Run /triage-feedback in Claude Code to process.\n\nexport HUB_BASE_URL=https://hub.neuroplans.app\nexport HUB_ADMIN_TOKEN=<your cookie>\ncd ~/.claude/skills/triage-feedback && pnpm triage');
}
```

The POST handler in `/api/feedback/triage-requests/route.ts` needs to extract the reviewer's email from the JWT and forward it. Verify this is already done in Task 10.

- [ ] **Step 4: Test by clicking the button in dev**

```bash
pnpm dev
# In browser: click Run Triage, verify an alert with the command appears
```

- [ ] **Step 5: Commit**

```bash
git add src/app/feedback/triage
git commit -m "feat(hub): reject modal with structured reasons + Run Triage button"
```

Phase 4 complete: `/feedback/triage` is fully functional end-to-end for approve, reject (with reasons), refine, and Run Triage.

---

## Phase 5 — `/feedback/analyze` redesigned UI

### Task 21: Build the theme view page

**Files:**
- Modify: `src/app/feedback/analyze/page.tsx` (replace existing UI entirely)
- Create: `src/app/feedback/analyze/AnalyzeClient.tsx`
- Create: `src/app/feedback/analyze/ThemeCard.tsx`

- [ ] **Step 1: Create `ThemeCard.tsx`**

```tsx
// src/app/feedback/analyze/ThemeCard.tsx
'use client';
import { useState } from 'react';

export interface Theme {
  themeId: string;
  description: string;
  voteCount: number;
  statusBreakdown: { approved: number; open: number; rejected: number };
  weeklyTrend: number[];
  trending: boolean;
  newVotesSinceDenial: number;
  lastActivityAt: string;
}

export function ThemeCard({ theme }: { theme: Theme }) {
  const [expanded, setExpanded] = useState(false);
  const isResurfacing = theme.newVotesSinceDenial > 0;
  const total = theme.statusBreakdown.approved + theme.statusBreakdown.open + theme.statusBreakdown.rejected;

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isResurfacing ? '#fecaca' : '#dedede'}`,
      boxShadow: isResurfacing ? '0 0 0 2px #fecaca40' : 'none',
      borderRadius: 8, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ background: '#e2d6fe', color: '#421d95', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, fontFamily: 'ui-monospace, Menlo, monospace' }}>{theme.themeId}</span>
            {theme.trending && <span style={{ background: '#bbf7d1', color: '#14532b', fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 500 }}>↑ trending</span>}
            {isResurfacing && <span style={{ background: '#fecaca', color: '#7f1d1d', fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 500 }}>⚠ {theme.newVotesSinceDenial} new votes since denial</span>}
          </div>
          <div style={{ fontSize: 13, color: '#0c0f14', fontWeight: 500 }}>{theme.description}</div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{theme.voteCount}</div>
          <div style={{ fontSize: 10, color: '#696a70', textTransform: 'uppercase', letterSpacing: 0.5 }}>votes</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#f1f1f1' }}>
            <div style={{ background: '#22c55e', width: `${(theme.statusBreakdown.approved / Math.max(1, total)) * 100}%` }} />
            <div style={{ background: '#eab308', width: `${(theme.statusBreakdown.open / Math.max(1, total)) * 100}%` }} />
            <div style={{ background: '#dedede', width: `${(theme.statusBreakdown.rejected / Math.max(1, total)) * 100}%` }} />
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#696a70', marginTop: 3 }}>
            <span>✓ {theme.statusBreakdown.approved}</span>
            <span>○ {theme.statusBreakdown.open}</span>
            <span>✗ {theme.statusBreakdown.rejected}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
          {theme.weeklyTrend.map((count, i) => {
            const max = Math.max(...theme.weeklyTrend, 1);
            return <div key={i} style={{ width: 4, height: `${(count / max) * 100}%`, background: '#54565c', borderRadius: 1 }} />;
          })}
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>{expanded ? 'Collapse ↑' : 'Expand ↓'}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `AnalyzeClient.tsx`**

```tsx
// src/app/feedback/analyze/AnalyzeClient.tsx
'use client';
import { useEffect, useState } from 'react';
import { ThemeCard, type Theme } from './ThemeCard';

interface AnalyzeResponse {
  timeRange: { from: string; to: string };
  stats: { totalSessions: number; totalThemes: number; trendingUp: number; newVotesSinceDenial: number; awaitingTriage: number };
  themes: Theme[];
}

export function AnalyzeClient() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<'votes' | 'trending' | 'recent' | 'resurfacing'>('votes');

  useEffect(() => {
    fetch(`/api/feedback/analyze?days=${days}`).then((r) => r.json()).then(setData);
  }, [days]);

  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;

  const sorted = [...data.themes].sort((a, b) => {
    if (sort === 'votes') return b.voteCount - a.voteCount;
    if (sort === 'trending') return Number(b.trending) - Number(a.trending);
    if (sort === 'recent') return b.lastActivityAt.localeCompare(a.lastActivityAt);
    if (sort === 'resurfacing') return b.newVotesSinceDenial - a.newVotesSinceDenial;
    return 0;
  });

  return (
    <div style={{ fontFamily: "-apple-system, sans-serif", background: '#f9f9f9', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #dedede', padding: '18px 24px' }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Themes & Patterns</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Stat label="Sessions" value={data.stats.totalSessions} />
          <Stat label="Themes" value={data.stats.totalThemes} />
          <Stat label="Trending up" value={data.stats.trendingUp} color="#14532b" />
          <Stat label="New votes since denial" value={data.stats.newVotesSinceDenial} color="#7f1d1d" />
          <a href="/feedback/triage"><Stat label="Awaiting triage" value={`${data.stats.awaitingTriage} →`} color="#1e478a" /></a>
        </div>
      </div>
      <div style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['votes', 'trending', 'recent', 'resurfacing'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} style={{
              background: sort === s ? '#0c0f14' : '#fff', color: sort === s ? '#fff' : '#54565c',
              border: '1px solid #dedede', fontSize: 11, padding: '5px 12px', borderRadius: 14, cursor: 'pointer',
            }}>{s === 'votes' ? 'Most votes' : s === 'trending' ? 'Trending' : s === 'recent' ? 'Most recent' : 'Re-surfacing'}</button>
          ))}
        </div>
        {sorted.map((t) => <ThemeCard key={t.themeId} theme={t} />)}
        {sorted.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#696a70' }}>No themes yet. Run /triage-feedback to populate.</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#696a70', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || '#0c0f14' }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `page.tsx`**

```tsx
// src/app/feedback/analyze/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/verify-auth';
import { AnalyzeClient } from './AnalyzeClient';

export default async function AnalyzePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('id_token')?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user?.isAdmin) redirect('/login?next=/feedback/analyze');
  return <AnalyzeClient />;
}
```

The OLD `page.tsx` had client-side Bedrock-calling code — delete all of that. The new client is pure query + render.

- [ ] **Step 4: Smoke test in dev**

```bash
pnpm dev
# visit /feedback/analyze — should load from /api/feedback/analyze
```

Expected: page loads, either empty or populated.

- [ ] **Step 5: Commit**

```bash
git add src/app/feedback/analyze
git commit -m "feat(hub): redesign /feedback/analyze as query-based theme view"
```

Phase 5 complete.

---

## Phase 6 — E2E, IAM verification, deploy

### Task 22: IAM verification for Bedrock on Amplify SSR role

- [ ] **Step 1: Identify the Amplify SSR role**

```bash
aws iam list-roles --profile sevaro-sandbox \
  --query "Roles[?contains(RoleName, 'SevaroHub')].RoleName"
```

Expected: `SevaroHub-AmplifySSR` or similar.

- [ ] **Step 2: Check existing Bedrock permissions**

```bash
aws iam list-attached-role-policies --profile sevaro-sandbox --role-name SevaroHub-AmplifySSR
aws iam list-role-policies --profile sevaro-sandbox --role-name SevaroHub-AmplifySSR
```

Look for a policy granting `bedrock:InvokeModel` on the Claude inference profile ARN.

- [ ] **Step 3: If missing, add inline policy**

```bash
cat > /tmp/bedrock-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:Converse"],
      "Resource": [
        "arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-sonnet-4-6",
        "arn:aws:bedrock:us-east-2:*:inference-profile/us.anthropic.claude-sonnet-4-6",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6-v1:0",
        "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-6-v1:0"
      ]
    }
  ]
}
EOF

aws iam put-role-policy --profile sevaro-sandbox \
  --role-name SevaroHub-AmplifySSR \
  --policy-name BedrockInvokeClaudeSonnet46 \
  --policy-document file:///tmp/bedrock-policy.json
```

- [ ] **Step 4: Test the refine-prompt Bedrock call from the deployed hub**

Deploy-or-local test. The easiest local test:

```bash
cd /Users/stevearbogast/dev/repos/sevaro-hub/.claude/worktrees/feedback-triage
AWS_PROFILE=sevaro-sandbox pnpm tsx -e "
import { refinePrompt } from './src/lib/bedrock-refine';
refinePrompt({ currentPrompt: 'echo hello', refinementInstruction: 'make it echo hi instead' }).then(console.log).catch(console.error);
"
```

Expected: returns `{ revisedPrompt: "echo hi", changeSummary: "..." }`.

- [ ] **Step 5: Document in infra/**

Append the policy JSON and the ARN-format note to `sevaro-feedback/infra/triage-tables.md`: *"Bedrock inference profile ARNs differ from foundation model ARNs — both must be included in the policy for cross-region inference."*

- [ ] **Step 6: Commit**

```bash
cd /Users/stevearbogast/dev/repos/sevaro-feedback/.claude/worktrees/feedback-triage
git add infra/triage-tables.md
git commit -m "docs(feedback): document Bedrock IAM policy for SevaroHub-AmplifySSR"
```

---

### Task 23: Playwright E2E smoke test

**Files:**
- Create: `sevaro-hub/playwright.config.ts`
- Create: `sevaro-hub/tests-e2e/feedback-triage.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd /Users/stevearbogast/dev/repos/sevaro-hub/.claude/worktrees/feedback-triage
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders: process.env.E2E_ID_TOKEN
      ? { cookie: `id_token=${process.env.E2E_ID_TOKEN}` }
      : undefined,
  },
});
```

- [ ] **Step 3: Create `tests-e2e/feedback-triage.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('triage queue loads and shows expected UI', async ({ page }) => {
  await page.goto('/feedback/triage');
  await expect(page.getByText(/Triage Queue/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Run Triage/i })).toBeVisible();
});

test('analyze themes page loads', async ({ page }) => {
  await page.goto('/feedback/analyze');
  await expect(page.getByText(/Themes & Patterns/i)).toBeVisible();
  await expect(page.getByText(/Sessions$/)).toBeVisible();
});

test('reject modal opens when clicking Reject', async ({ page }) => {
  await page.goto('/feedback/triage');
  const rejectBtn = page.getByRole('button', { name: /Reject/i }).first();
  if (await rejectBtn.isVisible()) {
    await rejectBtn.click();
    await expect(page.getByText(/Why reject this proposal/i)).toBeVisible();
  }
});
```

- [ ] **Step 4: Run against local dev**

```bash
pnpm dev &
# In another terminal:
E2E_BASE_URL=http://localhost:3000 E2E_ID_TOKEN="<your token>" pnpm exec playwright test
```

Expected: 3 tests PASS (or the third one skips if no proposals exist).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests-e2e
git commit -m "test(hub): playwright smoke tests for /feedback/triage and /feedback/analyze"
```

---

### Task 24: Deploy to Amplify staging and manual E2E smoke

- [ ] **Step 1: Push Phase 1 branch and redeploy Lambda**

Merge or deploy `sevaro-feedback` changes. If the Lambda is managed by a deploy script, run it; otherwise use `pnpm build && aws lambda update-function-code ...`.

- [ ] **Step 2: Push Phase 2-5 branch, let Amplify auto-deploy**

```bash
cd /Users/stevearbogast/dev/repos/sevaro-hub/.claude/worktrees/feedback-triage
git push origin feat/feedback-triage
```

Open a PR, merge when the build is green. Amplify auto-deploys from `main` on push.

- [ ] **Step 3: Create a disposable Cognito test user**

```bash
aws cognito-idp admin-create-user --profile sevaro-sandbox --region us-east-2 \
  --user-pool-id us-east-2_9y6XyJnXC \
  --username triage-test@sevaro.com \
  --user-attributes Name=email,Value=triage-test@sevaro.com Name=email_verified,Value=true \
  --temporary-password TempPass123!

aws cognito-idp admin-set-user-password --profile sevaro-sandbox --region us-east-2 \
  --user-pool-id us-east-2_9y6XyJnXC \
  --username triage-test@sevaro.com \
  --password TestPass456! --permanent
```

Add `triage-test@sevaro.com` to `ADMIN_EMAILS` env var in Amplify console.

- [ ] **Step 4: Log in as the test user in a separate browser profile**

Open Chrome in incognito (or a separate profile), navigate to `https://hub.neuroplans.app/login`, sign in with the test user credentials. Verify you land on the dashboard.

- [ ] **Step 5: Manual smoke test — full flow**

1. Submit a feedback session from Evidence Engine (or seed one via curl directly)
2. Visit `/feedback/triage` — confirm the session is NOT yet showing (no proposal)
3. Click "Run Triage on these N now" — confirm alert with skill command
4. Run the skill locally:
   ```bash
   export HUB_BASE_URL=https://hub.neuroplans.app
   export HUB_ADMIN_TOKEN="<triage-test cookie>"
   export AWS_PROFILE=sevaro-sandbox
   cd ~/.claude/skills/triage-feedback && pnpm triage
   ```
5. Refresh `/feedback/triage` — confirm proposal card appears
6. Click a proposal, try refinement with "make it shorter"
7. Approve — verify the improvement queue gets a new item (check `/admin/improvements`)
8. Visit `/feedback/analyze` — confirm the theme shows with 1 approved count
9. Seed another session, reject it, confirm theme now shows 1 approved + 1 rejected
10. Seed 2 more sessions with the same theme, triage, confirm theme card gets the "⚠ new votes since denial" chip

- [ ] **Step 6: Remove the test user**

```bash
aws cognito-idp admin-delete-user --profile sevaro-sandbox --region us-east-2 \
  --user-pool-id us-east-2_9y6XyJnXC \
  --username triage-test@sevaro.com
```

Remove `triage-test@sevaro.com` from `ADMIN_EMAILS`. Redeploy.

- [ ] **Step 7: Update sevaro-hub CLAUDE.md Body of Work**

Add a "Recent" entry documenting the feedback triage system going live, with a pointer to the spec and plan.

- [ ] **Step 8: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs(hub): feedback triage system live — update Body of Work"
```

Phase 6 complete. System is live on `hub.neuroplans.app`.

---

## Post-flight

- Close the worktrees once branches are merged:

```bash
cd /Users/stevearbogast/dev/repos/sevaro-hub
git worktree remove .claude/worktrees/feedback-triage

cd /Users/stevearbogast/dev/repos/sevaro-feedback
git worktree remove .claude/worktrees/feedback-triage
```

- Save improvement-queue items generated during the E2E test as real work, or purge them.
- Record the actual Bedrock IAM policy ARN format used in `sevaro-hub/CLAUDE.md` so future work has the reference.

## Rollback

If the feedback triage system needs to be rolled back:

1. Revert the last few commits on `main` in both repos
2. Redeploy Lambda and Amplify
3. The new DynamoDB tables can stay — they're empty after purge and cost nothing idle
4. The `triageProposal` field on session records is optional, so rolling back the Hub UI leaves stale data but doesn't break reads

## Deferred follow-ups (intentional, not gaps)

These were considered during spec/plan and consciously deferred. Track as new plan items later.

- **Unit test for Bedrock JSON parsing fallback.** `bedrock-refine.ts` and `bedrock-client.ts` both have defensive try/catch + markdown-fence-strip logic for parsing Claude output. Task 14's test mocks `refinePrompt` entirely, so the parsing branches aren't exercised. Add a focused test file `test/lib/bedrock-refine.test.ts` that feeds raw strings (plain JSON, markdown-fenced JSON, malformed, missing-fields) through a helper that calls just the parsing block.
- **Analyze page `?theme=<id>` deep link.** Task 19b's theme chip links to `/feedback/analyze?theme=fonts-too-small`. Task 21 doesn't read the query param. Follow-up: read `useSearchParams` in `AnalyzeClient`, scroll the matching card into view, and pulse-highlight it for 2 seconds.
- **Word-level diff for prompt revisions.** Task 19b's diff is naive line-level (`prevLines.has(line.trim())`). A real diff library (e.g., `diff` npm package) would highlight word- and char-level changes. Good follow-up when the UX feels rough in practice.
- **Theme slug canonicalization / cleanup.** Task 16's skill passes existing themes as a menu to Bedrock, which reduces drift but doesn't eliminate it. A periodic job could cluster semantically-similar themes (e.g., via embeddings) and merge them. Out of scope until drift becomes visible.
- **Vote threshold configurability.** Task 11 hard-codes `newVotesSinceDenial >= 1` as the re-surface flag trigger. Per the spec's open questions, this should become configurable (env var or admin settings page) if the threshold needs tuning.
- **Re-surface sort pill counter.** The "Re-surfacing" sort pill in Task 21 sorts correctly but doesn't show the count. Small polish: add `(N)` next to the pill label when `data.stats.newVotesSinceDenial > 0`.
- **Multi-admin management.** Spec explicitly non-goal for v1. Follow-up when a second admin needs the system.
