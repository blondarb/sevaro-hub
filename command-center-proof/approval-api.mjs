import {
  loadApprovalCatalog,
  executionState,
} from '../command-center/approvals.mjs';
import {
  exact,
  requireThat,
  ContextError,
  sha256,
} from '../command-center/context.mjs';
import { ApprovalStore } from './approval-store.mjs';
const LIMIT = 8192;
async function boundedBody(request) {
  requireThat(
    request.headers.get('content-type') === 'application/json',
    'json_required',
  );
  const reader = request.body?.getReader();
  requireThat(reader, 'body_required');
  let bytes = 0,
    parts = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > LIMIT) {
      await reader.cancel();
      requireThat(false, 'request_too_large');
    }
    parts.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
  } catch {
    throw new ContextError('invalid_request');
  }
}
export async function approvalApi(request, env, viewer, respond) {
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    requireThat(
      !url.search ||
        (url.pathname === '/api/approvals/history' &&
          [...url.searchParams.keys()].length === 1 &&
          /^[a-f0-9]{64}$/.test(cursor ?? '')),
      'invalid_request',
    );
    requireThat(
      [
        '/api/approvals',
        '/api/approvals/decide',
        '/api/approvals/approved',
        '/api/approvals/history',
        '/api/approvals/revoke',
      ].includes(url.pathname),
      'invalid_request',
    );
    requireThat(
      request.method ===
        (['/api/approvals/decide', '/api/approvals/revoke'].includes(
          url.pathname,
        )
          ? 'POST'
          : 'GET'),
      'method_not_allowed',
    );
    if (request.method === 'POST') {
      requireThat(
        request.headers.get('origin') === url.origin &&
          request.headers.get('x-command-approval') === 'exact-proposals-v1' &&
          [null, 'same-origin'].includes(request.headers.get('sec-fetch-site')),
        'origin_required',
      );
    }
    const owner = await sha256({ site_owner: viewer }),
      now = Date.now();
    if (url.pathname.endsWith('/history')) {
      const { receipts, next_cursor } = await new ApprovalStore(env.DB).history(
        owner,
        cursor,
      );
      return respond({
        next_cursor,
        receipts: receipts.map((r) => ({
          ...r,
          state: executionState(r, now),
        })),
        execution_enabled: false,
      });
    }
    if (url.pathname.endsWith('/revoke')) {
      const body = await boundedBody(request);
      exact(body, ['proposal_digest', 'expected_revision']);
      requireThat(
        /^[a-f0-9]{64}$/.test(body.proposal_digest) &&
          Number.isInteger(body.expected_revision) &&
          body.expected_revision > 0,
        'invalid_decisions',
      );
      const receipt = await new ApprovalStore(env.DB).revoke({
        digest: body.proposal_digest,
        owner,
        expectedRevision: body.expected_revision,
        now,
      });
      return respond({
        receipt,
        state: executionState(receipt, now),
        execution_enabled: false,
      });
    }
    const { catalog, digest, state } = await loadApprovalCatalog(env);
    if (!catalog) {
      requireThat(request.method === 'GET', 'no_proposals');
      return respond({
        state,
        catalog_digest: null,
        proposals: [],
        execution_enabled: false,
      });
    }
    const store = new ApprovalStore(env.DB);
    if (request.method === 'GET') {
      const proposals = [];
      for (const p of catalog.proposals) {
        const receipt = await store.latest(p.digest, owner);
        if (
          url.pathname.endsWith('/approved') &&
          (receipt?.decision !== 'approve' ||
            Date.parse(receipt.expires_at) <= now)
        )
          continue;
        proposals.push({
          ...p,
          approval_expires_at: catalog.expires_at,
          receipt,
          state: executionState(receipt, now),
        });
      }
      return respond({
        state: 'ready',
        catalog_digest: digest,
        classification: catalog.classification,
        expires_at: catalog.expires_at,
        proposals,
        execution_enabled: false,
        execution_note:
          'Approvals are saved for the retained delivery owner. No external action runs from this Site.',
      });
    }
    const body = await boundedBody(request);
    exact(body, ['catalog_digest', 'decisions']);
    requireThat(body.catalog_digest === digest, 'catalog_changed');
    requireThat(
      Array.isArray(body.decisions) &&
        body.decisions.length > 0 &&
        body.decisions.length <= 20,
      'invalid_decisions',
    );
    const seen = new Set();
    const selected = body.decisions.map((d) => {
      exact(d, ['proposal_digest', 'decision', 'expected_revision']);
      requireThat(
        !seen.has(d.proposal_digest) &&
          Number.isInteger(d.expected_revision) &&
          d.expected_revision >= 0 &&
          ['approve', 'defer', 'revoke'].includes(d.decision),
        'invalid_decisions',
      );
      seen.add(d.proposal_digest);
      const p = catalog.proposals.find((p) => p.digest === d.proposal_digest);
      requireThat(p, 'proposal_changed');
      return { d, p };
    });
    // The batch has explicit per-item outcomes. An uncertain save is not successful.
    const outcomes = [];
    for (const { d, p } of selected) {
      try {
        const receipt = await store.decide({
          proposal: { ...p, expires_at: catalog.expires_at },
          catalogDigest: digest,
          owner,
          decision: d.decision,
          expectedRevision: d.expected_revision,
          now,
        });
        outcomes.push({
          proposal_digest: p.digest,
          ok: true,
          receipt,
          state: executionState(receipt, now),
        });
      } catch (error) {
        outcomes.push({
          proposal_digest: p.digest,
          ok: false,
          error:
            error instanceof ContextError
              ? error.code
              : 'approval_save_uncertain',
        });
      }
    }
    return respond({
      catalog_digest: digest,
      outcomes,
      execution_enabled: false,
    });
  } catch (error) {
    const code =
      error instanceof ContextError ? error.code : 'approval_unavailable';
    const status =
      code === 'origin_required'
        ? 403
        : code === 'method_not_allowed'
          ? 405
          : code === 'request_too_large'
            ? 413
            : 409;
    return respond({ error: code, execution_enabled: false }, status);
  }
}
