// Exact reviewed proposals. This module captures consent; it never executes work.
import {
  exact,
  requireThat,
  instant,
  identifier,
  label,
  sha256,
  canonical,
} from './context.mjs';
import { isAllowedSourceUrl } from './source-links.mjs';
import { LINK_HOSTS } from './release.mjs';
const HASH = /^[a-f0-9]{64}$/;
const text = (v, max = 4000) => {
  requireThat(
    typeof v === 'string' &&
      v.trim().length > 0 &&
      v.length <= max &&
      !/[\u0000-\u0008\u000b-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(
        v,
      ),
    'invalid_proposal_text',
  );
  return v;
};
const nullable = (v) => {
  if (typeof v === 'string') {
    if (v.length) text(v);
    return;
  }
  requireThat(v === null || typeof v === 'boolean', 'invalid_change');
};
export async function validateProposal(p, now = Date.now()) {
  exact(p, [
    'proposal_id',
    'number',
    'kind',
    'title',
    'source_url',
    'source_revision',
    'observed_at',
    'expires_at',
    'executor',
    'payload',
    'digest',
  ]);
  identifier(p.proposal_id);
  requireThat(
    Number.isInteger(p.number) && p.number > 0 && p.number <= 100,
    'invalid_proposal_number',
  );
  label(p.title, 100);
  label(p.source_revision, 160);
  requireThat(
    isAllowedSourceUrl(p.source_url, LINK_HOSTS),
    'invalid_proposal_link',
  );
  requireThat(
    instant(p.observed_at) <= now &&
      instant(p.expires_at) > now &&
      instant(p.expires_at) > instant(p.observed_at) &&
      instant(p.expires_at) - instant(p.observed_at) <= 7200000,
    'proposal_expired',
  );
  if (p.kind === 'reply') {
    requireThat(p.executor === 'claude-communications', 'wrong_executor');
    exact(p.payload, [
      'channel',
      'account_ref',
      'thread_ref',
      'draft_revision',
      'to',
      'cc',
      'subject',
      'message',
      'attachments',
    ]);
    requireThat(
      ['email', 'slack'].includes(p.payload.channel),
      'invalid_channel',
    );
    label(p.payload.account_ref, 200);
    identifier(p.payload.thread_ref);
    label(p.payload.draft_revision, 160);
    for (const field of ['to', 'cc']) {
      requireThat(
        Array.isArray(p.payload[field]) && p.payload[field].length <= 20,
        'invalid_recipients',
      );
      const seen = new Set();
      for (const recipient of p.payload[field]) {
        label(recipient, 200);
        requireThat(!seen.has(recipient), 'duplicate_recipient');
        seen.add(recipient);
      }
    }
    requireThat(p.payload.to.length > 0, 'recipient_required');
    text(p.payload.subject, 200);
    text(p.payload.message);
    requireThat(
      Array.isArray(p.payload.attachments) &&
        p.payload.attachments.length === 0,
      'attachments_not_supported',
    );
    const url = new URL(p.source_url);
    requireThat(
      p.payload.thread_ref === url.pathname.split('/').at(-1),
      'reply_thread_mismatch',
    );
    if (p.payload.channel === 'email') {
      requireThat(
        url.hostname === 'outlook.office.com' &&
          url.pathname.startsWith('/mail/'),
        'invalid_reply_destination',
      );
      const recipients = [...p.payload.to, ...p.payload.cc].map((v) =>
        v.toLowerCase(),
      );
      requireThat(
        /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(p.payload.account_ref),
        'invalid_sending_account',
      );
      requireThat(
        recipients.every((v) =>
          /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v),
        ) && new Set(recipients).size === recipients.length,
        'invalid_recipients',
      );
    } else {
      requireThat(
        url.hostname === 'sevarohealth.slack.com' &&
          p.payload.to.length === 1 &&
          p.payload.cc.length === 0 &&
          p.payload.to[0] === url.pathname.split('/')[2],
        'invalid_reply_destination',
      );
    }
  } else {
    requireThat(
      p.kind === 'asana-change' && p.executor === 'asana-single-writer',
      'unsupported_action',
    );
    exact(p.payload, ['task_gid', 'changes']);
    requireThat(/^\d{6,30}$/.test(p.payload.task_gid), 'invalid_target');
    /* destination checked below */ requireThat(
      new URL(p.source_url).hostname === 'app.asana.com' &&
        new URL(p.source_url).pathname.split('/').includes(p.payload.task_gid),
      'target_link_mismatch',
    );
    requireThat(
      Array.isArray(p.payload.changes) &&
        p.payload.changes.length > 0 &&
        p.payload.changes.length <= 8,
      'invalid_changes',
    );
    const fields = new Set();
    for (const c of p.payload.changes) {
      exact(c, ['field', 'before', 'after']);
      requireThat(
        [
          'name',
          'notes',
          'completed',
          'assignee',
          'due_on',
          'stage',
          'priority',
          'comment',
        ].includes(c.field) && !fields.has(c.field),
        'invalid_change_field',
      );
      fields.add(c.field);
      nullable(c.before);
      nullable(c.after);
      requireThat(canonical(c.before) !== canonical(c.after), 'empty_change');
      if (c.field === 'completed')
        requireThat(
          typeof c.before === 'boolean' && typeof c.after === 'boolean',
          'invalid_change',
        );
      else
        requireThat(
          [c.before, c.after].every((v) => v === null || typeof v === 'string'),
          'invalid_change',
        );
      if (c.field === 'comment')
        requireThat(
          c.before === null && typeof c.after === 'string' && c.after.trim().length > 0,
          'invalid_comment',
        );
    }
  }
  const { digest, ...body } = p;
  requireThat(
    HASH.test(digest) && (await sha256(body)) === digest,
    'proposal_digest_mismatch',
  );
  return p;
}
export async function loadApprovalCatalog(env, now = Date.now()) {
  if (!env.APPROVAL_CATALOG)
    return { state: 'empty', catalog: null, digest: null };
  requireThat(
    env.APPROVAL_CATALOG_ENABLED === 'true',
    'approval_catalog_disabled',
  );
  requireThat(
    typeof env.APPROVAL_CATALOG === 'string' &&
      new TextEncoder().encode(env.APPROVAL_CATALOG).length <= 4096,
    'approval_catalog_too_large',
  );
  let c;
  try {
    c = JSON.parse(env.APPROVAL_CATALOG);
  } catch {
    throw Error('invalid_catalog');
  }
  exact(c, [
    'schema_version',
    'classification',
    'generated_at',
    'expires_at',
    'reviewed_by',
    'reviewed_at',
    'proposals',
  ]);
  requireThat(
    c.schema_version === 1 &&
      ['synthetic-only', 'executive-reviewed'].includes(c.classification),
    'review_required',
  );
  requireThat(
    c.reviewed_by === 'Codex' &&
      instant(c.reviewed_at) >= instant(c.generated_at) &&
      instant(c.reviewed_at) <= now,
    'review_required',
  );
  requireThat(
    instant(c.generated_at) <= now &&
      instant(c.expires_at) > now &&
      instant(c.expires_at) - instant(c.generated_at) <= 7200000,
    'catalog_expired',
  );
  const digest = await sha256(c);
  requireThat(
    digest === env.APPROVAL_CATALOG_SHA256,
    'catalog_digest_mismatch',
  );
  requireThat(
    Array.isArray(c.proposals) && c.proposals.length <= 20,
    'invalid_catalog',
  );
  const ids = new Set(),
    numbers = new Set();
  for (const p of c.proposals) {
    await validateProposal(p, now);
    requireThat(
      c.classification !== 'executive-reviewed' ||
        p.kind !== 'asana-change' ||
        p.payload.changes.every((c) => c.field === 'comment'),
      'task_field_delivery_unsupported',
    );
    requireThat(
      instant(p.expires_at) >= instant(c.expires_at) &&
        !ids.has(p.proposal_id) &&
        !numbers.has(p.number),
      'catalog_conflict',
    );
    ids.add(p.proposal_id);
    numbers.add(p.number);
  }
  return { state: 'ready', catalog: c, digest };
}
export function nextDecision(previous, decision) {
  requireThat(
    ['approve', 'defer', 'revoke'].includes(decision),
    'invalid_decision',
  );
  if (previous === decision) return 'unchanged';
  requireThat(
    previous !== 'revoke' &&
      !(previous === 'approve' && decision !== 'revoke') &&
      !(decision === 'revoke' && previous !== 'approve'),
    'decision_conflict',
  );
  return decision;
}
export function executionState(receipt, now = Date.now()) {
  if (!receipt) return 'Awaiting approval';
  if (receipt.decision === 'revoke') return 'Approval withdrawn';
  if (instant(receipt.expires_at) <= now) return 'Expired — new review needed';
  return receipt.decision === 'approve'
    ? 'Approved — waiting for delivery'
    : 'Deferred';
}
