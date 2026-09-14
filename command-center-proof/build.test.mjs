import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { database, synthetic } from './testing/synthetic.mjs';
test('isolated artifact includes usable migrations and approval runtime but no collectors or test content', async () => {
  const root = await mkdtemp('/private/tmp/approval-build-test-'),
    destination = root + '/site';
  try {
    execFileSync(process.execPath, [
      new URL('build.mjs', import.meta.url).pathname,
      destination,
    ]);
    const files = await readdir(destination + '/dist', { recursive: true });
    assert.ok(files.includes('.openai/drizzle/0000_approval_receipts.sql'));
    assert.ok(files.includes('.openai/drizzle/0001_delivery_receipts.sql'));
    assert.ok(
      !files.some((x) =>
        /testing|fixture|adapter|collector|node_modules/.test(x),
      ),
    );
    const manifest = JSON.parse(
      await readFile(destination + '/dist/.openai/hosting.json', 'utf8'),
    );
    assert.equal(manifest.d1, 'DB');
    assert.equal(
      manifest.project_id,
      'appgprj_6aa6deb2d21881919267767a67b881fd',
    );
    const worker = (
      await import(pathToFileURL(destination + '/dist/server/index.js'))
    ).default;
    const { env } = await synthetic();
    env.DB = await database();
    const req = (path) =>
      new Request('https://proof.example' + path, {
        headers: { 'oai-authenticated-user-id': 'synthetic-owner' },
      });
    const response = await worker.fetch(req('/api/approvals'), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).proposals.length, 2);
    const browser = await (
      await worker.fetch(req('/approvals.js'), env)
    ).text();
    assert.match(browser, /read_approval_inbox/);
    assert.match(browser, /claim_approved_action/);
    assert.match(browser, /record_delivery_outcome/);
    assert.ok(!browser.includes('casey@example.com'));
    const history=await worker.fetch(req('/api/delivery/history'),env);
    assert.equal(history.status,200);
    assert.equal((await history.json()).capabilities.enabled,false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
