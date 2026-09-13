import assert from 'node:assert/strict';
import { mkdtemp, mkdir, chmod, readFile, writeFile, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compareCandidates, refreshOnce } from '../refresh.mjs';
import { sha256 } from '../context.mjs';
import { row, source } from './fixtures.mjs';

const NOW = Date.parse('2026-09-13T20:00:00.000Z');
async function root() { const path = await mkdtemp(join(tmpdir(), 'command-center-refresh-')); await chmod(path, 0o700); return path; }
function plan() { return { schema_version: 1, sources: [{ source_id: 'asana:portfolio', system: 'asana', project_id: '1200', entries: [], stage_labels: {} }] }; }
function collect(feeds = [source()]) { return async () => ({ expected_sources: ['asana:portfolio'], feeds }); }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }

test('prepares a pending candidate and metadata-only health receipt', async () => {
  const path = await root();
  const result = await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  assert.equal(result.ok, true); assert.equal(result.requires_review, true); assert.equal(result.notify, true);
  const candidate = await json(join(path, 'proposed-current-context.json'));
  const health = await json(join(path, 'refresh-health.json'));
  assert.equal(candidate.classification, 'executive-pending-review');
  assert.equal(health.candidate_digest, result.candidate_digest);
  assert.deepEqual(Object.keys(health).sort(), ['candidate_classification','candidate_digest','candidate_expires_at','delta','failure_code','freshness_state','last_attempt_at','last_failure_at','last_failure_code','last_success_at','recovery_state','schema_version','source_counts','sources']);
  assert.equal(await lstat(join(path, '.command-center-refresh.lock')).then(() => true, () => false), false);
});

test('quiet rerun ignores generated time and source-revision-only changes', async () => {
  const path = await root();
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  const changed = source({ observed_at: '2026-09-13T20:01:00.000Z', expires_at: '2026-09-13T21:01:00.000Z', items: [row({ source_revision: '2' })] });
  const result = await refreshOnce({ root: path, plan: plan(), collect: collect([changed]), now: NOW + 60_000 });
  assert.equal(result.ok, true); assert.equal(result.notify, false); assert.equal(result.delta.revision_only, 1);
  assert.equal((await json(join(path, 'proposed-prior-context.json'))).classification, 'executive-pending-review');
});

test('failed total collection preserves the last good candidate and records no raw error', async () => {
  const path = await root();
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  const before = await readFile(join(path, 'proposed-current-context.json'), 'utf8');
  const result = await refreshOnce({ root: path, plan: plan(), collect: async () => { throw new Error('do not leak payload text'); }, now: NOW + 60_000 });
  assert.equal(result.ok, false); assert.equal(result.failure_code, 'run_failed');
  assert.equal(result.freshness_state, 'retained_previous');
  assert.equal(await readFile(join(path, 'proposed-current-context.json'), 'utf8'), before);
  const health = await readFile(join(path, 'refresh-health.json'), 'utf8');
  assert.equal(health.includes('do not leak'), false);
});

test('records collector-unavailable states while retaining the prior candidate', async () => {
  const path = await root();
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  const unavailable = source({ status: 'unavailable', failure_code: 'permission_required', items: [] });
  const result = await refreshOnce({ root: path, plan: plan(), collect: collect([unavailable]), now: NOW + 60_000 });
  assert.equal(result.ok, false); assert.equal(result.notify, true);
  const health = await json(join(path, 'refresh-health.json'));
  assert.deepEqual(health.sources, [{ source_id: 'asana:portfolio', state: 'unavailable', failure_code: 'permission_required' }]);
});

test('rejects an existing lock and unsafe roots or leaves', async () => {
  const path = await root();
  await writeFile(join(path, '.command-center-refresh.lock'), '', { mode: 0o600 });
  await assert.rejects(refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW }), /refresh_locked/);
  const unsafe = await root(); await chmod(unsafe, 0o755);
  await assert.rejects(refreshOnce({ root: unsafe, plan: plan(), collect: collect(), now: NOW }), /private_output_directory_required/);
  const safe = await root(); await writeFile(join(safe, 'proposed-current-context.json'), '{}', { mode: 0o600 });
  await symlink(join(safe, 'proposed-current-context.json'), join(safe, 'refresh-health.json'));
  await assert.rejects(refreshOnce({ root: safe, plan: plan(), collect: collect(), now: NOW }), /private_file_required/);
});

test('leaves unrelated preexisting temp files alone', async () => {
  const path = await root(); const orphan = join(path, '.proposed-current-context.json.someone.tmp');
  await writeFile(orphan, 'keep', { mode: 0o600 });
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  assert.equal(await readFile(orphan, 'utf8'), 'keep');
});

test('recovers from an interrupted receipt write without touching the candidate', async () => {
  const path = await root();
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  const before = await readFile(join(path, 'proposed-current-context.json'), 'utf8');
  await writeFile(join(path, 'refresh-health.json'), '{partial', { mode: 0o600 });
  const result = await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW + 60_000 });
  assert.equal(result.ok, true); assert.equal(result.notify, false);
  assert.notEqual(await readFile(join(path, 'proposed-current-context.json'), 'utf8'), before); // generation time is allowed to advance
  assert.equal((await json(join(path, 'refresh-health.json'))).failure_code, null);
});

test('candidate replacement failure preserves current and never reports success',async()=>{
 const path=await root();const first=await refreshOnce({root:path,plan:plan(),collect:collect(),now:NOW});
 const before=await readFile(join(path,'proposed-current-context.json'),'utf8');
 const result=await refreshOnce({root:path,plan:plan(),collect:collect(),now:NOW+1000,write:async(directory,name,value)=>{if(name==='proposed-current-context.json')throw Error('synthetic disk failure');await writeFile(join(directory,name),JSON.stringify(value),{mode:0o600});}});
 assert.equal(result.ok,false);assert.equal(result.candidate_digest,first.candidate_digest);
 assert.equal(await readFile(join(path,'proposed-current-context.json'),'utf8'),before);
 assert.equal((await json(join(path,'refresh-health.json'))).last_success_at,new Date(NOW).toISOString());
 const recovered=await refreshOnce({root:path,plan:plan(),collect:collect(),now:NOW+2000});assert.equal(recovered.ok,true);assert.equal(recovered.notify,true);
 assert.equal((await json(join(path,'refresh-health.json'))).last_failure_code,'run_failed');
});
test('canonical field order does not manufacture material changes',async()=>{
 const path=await root();await refreshOnce({root:path,plan:plan(),collect:collect(),now:NOW});
 const p=join(path,'proposed-current-context.json'),s=await json(p);const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 await writeFile(p,JSON.stringify(canonical(s)),{mode:0o600});
 const result=await refreshOnce({root:path,plan:plan(),collect:collect(),now:NOW+1000});assert.equal(result.notify,false);assert.equal(result.delta.changed,0);
});

test('recovers a corrupt current from a valid prior without rotating the corrupt leaf', async () => {
  const path = await root();
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW });
  await refreshOnce({ root: path, plan: plan(), collect: collect(), now: NOW + 1_000 });
  const prior = await json(join(path, 'proposed-prior-context.json'));
  await writeFile(join(path, 'proposed-current-context.json'), '{corrupt', { mode: 0o600 });
  // Syntactically valid but schema-invalid receipt must not supply a digest or history.
  await writeFile(join(path, 'refresh-health.json'), JSON.stringify({ candidate_digest: 'f'.repeat(64) }), { mode: 0o600 });
  const result = await refreshOnce({ root: path, plan: plan(), collect: async () => { throw new Error('offline'); }, now: NOW + 2_000 });
  assert.equal(result.ok, false); assert.equal(result.recovery_state, 'used_prior');
  assert.equal(result.freshness_state, 'retained_previous');
  assert.equal(result.candidate_digest, await sha256(prior));
  assert.equal(await readFile(join(path, 'proposed-current-context.json'), 'utf8'), '{corrupt');
  assert.equal((await json(join(path, 'refresh-health.json'))).recovery_state, 'used_prior');
  const recovered = await refreshOnce({root:path,plan:plan(),collect:collect(),now:NOW+3_000});
  assert.equal(recovered.recovery_state,'replaced_invalid_current');assert.equal(recovered.notify,true);
  assert.deepEqual(await json(join(path,'proposed-prior-context.json')),prior);
});

test('removed source health is counted as a failure-worthy health change', () => {
  const compared = compareCandidates(
    { items: [], health: [{ source_id: 'asana:portfolio', state: 'available', failure_code: null }] },
    { items: [], health: [] }
  );
  assert.equal(compared.health_changed, 1); assert.equal(compared.new_failure, true);
});
