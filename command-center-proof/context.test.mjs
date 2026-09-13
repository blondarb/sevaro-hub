import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, readContext, resolveItem } from './context.mjs';
import worker from './worker.mjs';
const pins = { snapshot_id: snapshot.snapshot_id, view_id: snapshot.view_id };
const at = Date.parse(snapshot.generated_at);
mock.method(Date, 'now', () => at);
test('visual and conversational reference resolve the same immutable item', () => {
  const visual = readContext(pins.snapshot_id, pins.view_id, at);
  const voiceTool = resolveItem({ ...pins, phrase: 'tell me about number two' }, at);
  assert.equal(voiceTool.item, visual.items[1]);
  assert.equal(voiceTool.item.item_id, 'synthetic:blocker:harbor');
  assert.throws(() => { visual.items[1].number = 9; }, TypeError);
});
test('old view, expired snapshot, ambiguous references and action intent refuse', () => {
  assert.throws(() => readContext(pins.snapshot_id, 'other-view', at));
  assert.throws(() => readContext(pins.snapshot_id, pins.view_id, Date.parse(snapshot.expires_at)));
  for (const phrase of ['two or three', 'approve number two', 'send it', '4', ''])
    assert.throws(() => resolveItem({ ...pins, phrase }, at));
});
const req = (path, viewer, method = 'GET') => new Request('https://proof.example' + path, { method, headers: viewer ? { 'oai-authenticated-user-id': viewer } : {} });
test('every route denies absent identity, unset owner binding and another user', async () => {
  for (const path of ['/', '/proof.js', '/api/context', '/api/resolve']) {
    assert.equal((await worker.fetch(req(path))).status, 401);
    assert.equal((await worker.fetch(req(path, 'owner'))).status, 503);
    assert.equal((await worker.fetch(req(path, 'other'), { PROOF_OWNER_SITE_USER_ID: 'owner' })).status, 403);
  }
});
test('API returns same pins and rejects mutations or unreviewed query fields', async () => {
  const env = { PROOF_OWNER_SITE_USER_ID: 'owner' };
  const url = '/api/context?' + new URLSearchParams(pins);
  const r = await worker.fetch(req(url, 'owner'), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), snapshot);
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
    assert.equal((await worker.fetch(req(url, 'owner', method), env)).status, 405);
  assert.equal((await worker.fetch(req(url + '&raw_email=forbidden', 'owner'), env)).status, 400);
});
