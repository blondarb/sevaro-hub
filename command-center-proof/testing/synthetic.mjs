// Fictional local examples only. Build allowlist excludes this module.
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { sha256 } from '../../command-center/context.mjs';
export async function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of (await readdir(new URL('../drizzle/', import.meta.url)))
    .filter((x) => x.endsWith('.sql'))
    .sort())
    db.exec(
      await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'),
    );
  return {
    raw: db,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return db.prepare(sql).get(...args) ?? null;
            },
            async all() {
              return { results: db.prepare(sql).all(...args) };
            },
          };
        },
      };
    },
  };
}
export async function synthetic(now = Date.now()) {
  const stamp = (n) => new Date(now + n).toISOString();
  const base = {
    source_revision: 'fictional-revision-1',
    observed_at: stamp(-1000),
    expires_at: stamp(3600000),
  };
  const proposals = [
    {
      ...base,
      proposal_id: 'synthetic:cedar:reply',
      number: 1,
      kind: 'reply',
      title: 'Cedar planning reply',
      source_url: 'https://outlook.office.com/mail/inbox/id/synthetic-cedar',
      executor: 'claude-communications',
      payload: {
        channel: 'email',
        account_ref: 'steve@example.com',
        thread_ref: 'synthetic-cedar',
        draft_revision: 'draft-1',
        to: ['casey@example.com'],
        cc: [],
        subject: 'Cedar planning',
        message:
          'Thanks, Casey. Please share the revised planning outline for review.',
        attachments: [],
      },
    },
    {
      ...base,
      proposal_id: 'synthetic:harbor:comment',
      number: 2,
      kind: 'asana-change',
      title: 'Harbor progress note',
      source_url: 'https://app.asana.com/0/999999/888888',
      executor: 'asana-single-writer',
      payload: {
        task_gid: '888888',
        changes: [
          {
            field: 'comment',
            before: null,
            after: 'The fictional dependency review is ready for discussion.',
          },
        ],
      },
    },
  ];
  for (const p of proposals) p.digest = await sha256(p);
  const catalog = {
    schema_version: 1,
    classification: 'synthetic-only',
    generated_at: stamp(-1000),
    expires_at: stamp(3500000),
    reviewed_by: 'Codex',
    reviewed_at: stamp(-500),
    proposals,
  };
  return {
    catalog,
    env: {
      PROOF_OWNER_SITE_USER_ID: 'synthetic-owner',
      APPROVAL_CATALOG: JSON.stringify(catalog),
      APPROVAL_CATALOG_SHA256: await sha256(catalog),
      APPROVAL_CATALOG_ENABLED: 'true',
    },
  };
}
