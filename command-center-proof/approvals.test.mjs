import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import { database, synthetic } from './testing/synthetic.mjs';
import { sha256 } from '../command-center/context.mjs';
import { loadApprovalCatalog } from '../command-center/approvals.mjs';
const origin = 'https://proof.example';
async function fixture() {
  const { catalog, env } = await synthetic();
  env.DB = await database();
  return { catalog, env };
}
function request(path, body, extra = {}) {
  return new Request(origin + '/api/approvals' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'oai-authenticated-user-id': 'synthetic-owner',
      origin,
      'content-type': 'application/json',
      'x-command-approval': 'exact-proposals-v1',
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const choice = (catalog, decision = 'approve', revision = 0, index = 0) => ({
  proposal_digest: catalog.proposals[index].digest,
  decision,
  expected_revision: revision,
});
const decide = (env, decisions, digest = env.APPROVAL_CATALOG_SHA256) =>
  worker.fetch(request('/decide', { catalog_digest: digest, decisions }), env);
const rows = (env) => env.DB.raw.prepare('SELECT * FROM approval_events').all();
test('all approval routes require authenticated owner, never CORS', async () => {
  const { env } = await fixture();
  for (const path of ['', '/approved', '/history', '/decide', '/revoke']) {
    for (const owner of ['', 'another-owner']) {
      const r = await worker.fetch(
        request(
          path,
          path === '/decide' || path === '/revoke' ? {} : undefined,
          { 'oai-authenticated-user-id': owner },
        ),
        env,
      );
      assert.equal(r.status, owner ? 403 : 401);
      assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
    }
  }
  assert.equal(rows(env).length, 0);
});
test('same-origin JSON and bounded body are mandatory', async () => {
  const { catalog, env } = await fixture(),
    body = {
      catalog_digest: env.APPROVAL_CATALOG_SHA256,
      decisions: [choice(catalog)],
    };
  for (const headers of [
    { origin: 'https://evil.example' },
    { origin: '' },
    { 'sec-fetch-site': 'cross-site' },
    { 'x-command-approval': '' },
    { 'content-type': 'text/plain' },
  ])
    assert.ok(
      (await worker.fetch(request('/decide', body, headers), env)).status >=
        400,
    );
  assert.equal(
    (await worker.fetch(request('/decide', { padding: 'x'.repeat(9000) }), env))
      .status,
    413,
  );
  assert.equal(rows(env).length, 0);
});
test('exact payload, current digest and source freshness are required', async () => {
  const { catalog, env } = await fixture();
  assert.equal(
    (await decide(env, [choice(catalog)], '0'.repeat(64))).status,
    409,
  );
  assert.equal(
    (await decide(env, [{ ...choice(catalog), payload: { send: true } }]))
      .status,
    409,
  );
  const changed = structuredClone(catalog);
  changed.proposals[0].payload.message = 'Different text';
  const tampered = {
    ...env,
    APPROVAL_CATALOG: JSON.stringify(changed),
    APPROVAL_CATALOG_SHA256: await sha256(changed),
  };
  assert.equal((await decide(tampered, [choice(catalog)])).status, 409);
  await assert.rejects(
    () => loadApprovalCatalog(env, Date.parse(catalog.expires_at)),
    /catalog_expired/,
  );
  assert.equal(rows(env).length, 0);
});
test('duplicate and concurrent approval requests persist one receipt without dispatch', async () => {
  const { catalog, env } = await fixture();
  const responses = await Promise.all([
    decide(env, [choice(catalog)]),
    decide(env, [choice(catalog)]),
  ]);
  for (const r of responses) {
    const b = await r.json();
    assert.equal(b.outcomes[0].ok, true);
    assert.equal(b.execution_enabled, false);
    assert.match(b.outcomes[0].state, /waiting for delivery/);
  }
  const saved = rows(env);
  assert.equal(saved.length, 1);
  assert.notEqual(saved[0].owner_id, 'synthetic-owner');
  assert.equal(saved[0].source_revision, catalog.proposals[0].source_revision);
  assert.ok(
    !JSON.stringify(saved).includes(catalog.proposals[0].payload.message),
  );
});
test('conflicting racing tabs cannot overwrite consent', async () => {
  const { catalog, env } = await fixture();
  const rs = await Promise.all([
    decide(env, [choice(catalog, 'approve')]),
    decide(env, [choice(catalog, 'defer')]),
  ]);
  const bodies = await Promise.all(rs.map((r) => r.json()));
  assert.equal(bodies.filter((b) => b.outcomes[0].ok).length, 1);
  assert.equal(rows(env).length, 1);
});
test('defer can become approval, then withdrawal remains available after catalog removal', async () => {
  const { catalog, env } = await fixture();
  await decide(env, [choice(catalog, 'defer')]);
  await decide(env, [choice(catalog, 'approve', 1)]);
  env.APPROVAL_CATALOG = '';
  env.APPROVAL_CATALOG_ENABLED = 'false';
  const history = await (await worker.fetch(request('/history'), env)).json();
  assert.equal(history.receipts[0].revision, 2);
  const body = {
    proposal_digest: catalog.proposals[0].digest,
    expected_revision: 2,
  };
  for (let i = 0; i < 2; i++) {
    const r = await worker.fetch(request('/revoke', body), env);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).state, 'Approval withdrawn');
  }
  assert.equal(rows(env).length, 3);
});
test('withdrawal does not depend on fresh source and cannot be reapproved from old payload', async () => {
  const { catalog, env } = await fixture();
  await decide(env, [choice(catalog)]);
  env.DB.raw
    .prepare('UPDATE approval_events SET expires_at=?')
    .run('2000-01-01T00:00:00Z');
  const r = await worker.fetch(
    request('/revoke', {
      proposal_digest: catalog.proposals[0].digest,
      expected_revision: 1,
    }),
    env,
  );
  assert.equal(r.status, 200);
  const b = await (await decide(env, [choice(catalog, 'approve', 2)])).json();
  assert.equal(b.outcomes[0].error, 'decision_conflict');
});
test('partial storage failure preserves successful item and supports receipt readback', async () => {
  const { catalog, env } = await fixture();
  const real = env.DB;
  env.DB = {
    prepare(sql) {
      const statement = real.prepare(sql);
      return {
        bind(...args) {
          if (
            sql.startsWith('INSERT') &&
            args.includes(catalog.proposals[1].digest)
          )
            throw Error('private database detail');
          return statement.bind(...args);
        },
      };
    },
  };
  const b = await (
    await decide(env, [choice(catalog), choice(catalog, 'approve', 0, 1)])
  ).json();
  assert.equal(b.outcomes[0].ok, true);
  assert.equal(b.outcomes[1].error, 'approval_save_uncertain');
  assert.ok(!JSON.stringify(b).includes('private database'));
  env.DB = real;
  const inbox = await (await worker.fetch(request(''), env)).json();
  assert.equal(inbox.proposals[0].receipt.revision, 1);
  assert.equal(inbox.proposals[1].receipt, null);
  await decide(env, [choice(catalog), choice(catalog, 'approve', 0, 1)]);
  assert.equal(rows(env).length, 2);
});
test('write succeeds but response fails: readback and retry do not duplicate', async () => {
  const { catalog, env } = await fixture(),
    real = env.DB;
  let once = true;
  env.DB = {
    prepare(sql) {
      const s = real.prepare(sql);
      return {
        bind(...args) {
          const bound = s.bind(...args);
          return {
            ...bound,
            async first() {
              const r = await bound.first();
              if (sql.startsWith('INSERT') && once) {
                once = false;
                throw Error('lost response');
              }
              return r;
            },
          };
        },
      };
    },
  };
  const b = await (await decide(env, [choice(catalog)])).json();
  assert.equal(b.outcomes[0].ok, false);
  const retry = await (await decide(env, [choice(catalog)])).json();
  assert.equal(retry.outcomes[0].ok, true);
  assert.equal(rows({ ...env, DB: real }).length, 1);
});
test('no configured proposals is empty and absent storage fails closed', async () => {
  const { env } = await fixture();
  delete env.DB;
  assert.equal((await worker.fetch(request(''), env)).status, 409);
  env.APPROVAL_CATALOG = '';
  assert.deepEqual(
    (await (await worker.fetch(request(''), env)).json()).proposals,
    [],
  );
});
test('approval pages cannot be framed for clickjacking', async () => {
  const { env } = await fixture();
  const r = await worker.fetch(
    new Request(origin, {
      headers: { 'oai-authenticated-user-id': 'synthetic-owner' },
    }),
    env,
  );
  assert.match(
    r.headers.get('Content-Security-Policy'),
    /frame-ancestors 'none'/,
  );
  assert.equal(r.headers.get('X-Frame-Options'), 'DENY');
});
test('owner receipts stay isolated across owner binding rotation', async () => {
  const { catalog, env } = await fixture();
  await decide(env, [choice(catalog)]);
  const owner2 = { ...env, PROOF_OWNER_SITE_USER_ID: 'another-owner' };
  const r = await worker.fetch(
    request(
      '/decide',
      {
        catalog_digest: env.APPROVAL_CATALOG_SHA256,
        decisions: [choice(catalog)],
      },
      { 'oai-authenticated-user-id': 'another-owner' },
    ),
    owner2,
  );
  assert.equal((await r.json()).outcomes[0].ok, true);
  assert.equal(rows(env).length, 2);
  const h = await (await worker.fetch(request('/history'), env)).json();
  assert.equal(h.receipts.length, 1);
});
test('hidden text and inconsistent reply targets cannot enter consent', async () => {
  const { catalog, env } = await fixture();
  for (const mutate of [
    (c) => (c.proposals[0].payload.message += '\u200e'),
    (c) => (c.proposals[0].payload.subject += '\u061c'),
    (c) => (c.proposals[1].payload.changes[0].after += '\u0000'),
    (c) => (c.proposals[0].payload.thread_ref = 'wrong-thread'),
    (c) => (c.proposals[0].payload.account_ref = 'hidden-account'),
  ]) {
    const c = structuredClone(catalog);
    mutate(c);
    for (const p of c.proposals) {
      const { digest, ...rest } = p;
      p.digest = await sha256(rest);
    }
    const altered = {
      ...env,
      APPROVAL_CATALOG: JSON.stringify(c),
      APPROVAL_CATALOG_SHA256: await sha256(c),
    };
    await assert.rejects(() => loadApprovalCatalog(altered));
  }
});
test('unconnected real Asana task fields remain blocked; oversized catalogs refuse', async () => {
  const { catalog, env } = await fixture();
  const c = structuredClone(catalog);
  c.classification = 'executive-reviewed';
  c.proposals[1].payload.changes = [
    { field: 'completed', before: false, after: true },
  ];
  const { digest, ...rest } = c.proposals[1];
  c.proposals[1].digest = await sha256(rest);
  await assert.rejects(
    async () =>
      loadApprovalCatalog({
        ...env,
        APPROVAL_CATALOG: JSON.stringify(c),
        APPROVAL_CATALOG_SHA256: await sha256(c),
      }),
    /task_field_delivery_unsupported/,
  );
  await assert.rejects(
    () => loadApprovalCatalog({ ...env, APPROVAL_CATALOG: ' '.repeat(4097) }),
    /approval_catalog_too_large/,
  );
});
test('paginated history allows older approval discovery and revocation after catalog rotation', async () => {
  const { catalog, env } = await fixture();
  await decide(env, [choice(catalog)]);
  const seed = rows(env)[0],
    cols = Object.keys(seed);
  const insert = env.DB.raw.prepare(
    'INSERT INTO approval_events (' +
      cols.join(',') +
      ') VALUES (' +
      cols.map(() => '?').join(',') +
      ')',
  );
  for (let i = 0; i < 105; i++) {
    const row = {
      ...seed,
      event_id: await sha256({ event: i }),
      proposal_digest: await sha256({ proposal: i }),
      proposal_id: 'synthetic:extra:' + i,
      decision: 'defer',
      recorded_at: new Date(Date.now() + i + 1).toISOString(),
    };
    insert.run(...cols.map((c) => row[c]));
  }
  env.APPROVAL_CATALOG = '';
  let cursor = null,
    found = false,
    total = 0;
  do {
    const r = await worker.fetch(
      request('/history' + (cursor ? '?cursor=' + cursor : '')),
      env,
    );
    assert.equal(r.status, 200);
    const data = await r.json();
    total += data.receipts.length;
    found ||= data.receipts.some(
      (r) => r.proposal_digest === seed.proposal_digest,
    );
    cursor = data.next_cursor;
  } while (cursor);
  assert.equal(total, 106);
  assert.equal(found, true);
  const r = await worker.fetch(
    request('/revoke', {
      proposal_digest: seed.proposal_digest,
      expected_revision: 1,
    }),
    env,
  );
  assert.equal(r.status, 200);
});
test('empty or whitespace-only actions cannot acquire approval', async () => {
  const {catalog,env}=await fixture();
  for(const value of ['', '  \n\t']){
    for(const target of ['comment','message']){
      const c=structuredClone(catalog);
      if(target==='comment')c.proposals[1].payload.changes[0].after=value;
      else c.proposals[0].payload.message=value;
      for(const p of c.proposals){const {digest,...body}=p;p.digest=await sha256(body);}
      const altered={...env,APPROVAL_CATALOG:JSON.stringify(c),APPROVAL_CATALOG_SHA256:await sha256(c)};
      await assert.rejects(()=>loadApprovalCatalog(altered));
    }
  }
});
