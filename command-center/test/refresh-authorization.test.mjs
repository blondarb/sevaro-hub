import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble, sha256} from '../context.mjs';
import {loadRuntimeSnapshot, snapshotBindings} from '../release.mjs';
import {bindReviewedRefresh} from '../refresh-authorization.mjs';
import {NOW, source} from './fixtures.mjs';

async function setup() {
  const at = offset => new Date(NOW + offset).toISOString();
  const authorization = {schema_version:1,approved_by:'Steve',approved_at:at(-1000),expires_at:at(600000),site_project_id:'appgprj_example',scope:'reviewed-executive-metadata-owner-only-read-only-refresh',sources:['asana:portfolio'],constraints:['no PHI, raw bodies or transcripts','preserve source observation and expiry','review content before each release','exact snapshot digest and expiry bound receipt per release','no source writes, sends, assignments, stage decisions or automatic merge','owner-only audience unchanged'],remaining_access_limits:['synthetic acceptance'],credential_exception:'spent',automatic_refresh_installed:false,credential_exception_consumed:true,refresh_mechanism:'Existing task',automatic_refresh_note:'No unattended publication'};
  const candidate = await assemble([source()], {expectedSources:['asana:portfolio'],allowedHosts:['app.asana.com'],classification:'executive-pending-review',now:NOW,ttlMs:7200000});
  return {authorization,anchor:{authorization_digest:await sha256(authorization),site_project_id:'appgprj_example',saved_version_id:'appgprj_example~appgver_existing'},candidate:structuredClone(candidate),review:{candidate_digest:await sha256(candidate),reviewed_by:'Codex',reviewed_at:at(0),policy:'executive-project-context-v1'},siteProjectId:'appgprj_example',savedVersionId:'appgprj_example~appgver_existing',now:NOW};
}
test('reviewed refresh binds exact content, destination and cutoff for the existing runtime', async () => {
  const input = await setup(), before = structuredClone(input);
  const bound = await bindReviewedRefresh(input);
  assert.deepEqual(input, before);
  assert.deepEqual(bound.snapshot.items, input.candidate.items);
  assert.deepEqual(bound.snapshot.health, input.candidate.health);
  assert.equal(bound.snapshot.expires_at, input.authorization.expires_at);
  assert.equal(bound.receipt.kind, 'policy-derived-refresh');
  assert.equal(bound.receipt.authorized_at, input.authorization.approved_at);
  assert.notEqual(bound.receipt.authorized_at,bound.receipt.bound_at);
  assert.equal(bound.approval, undefined);
  assert.notEqual(bound.snapshot.snapshot_id, input.candidate.snapshot_id);
  const env = {...snapshotBindings(bound.release.payload),CONTEXT_SOURCE_MODE:'runtime',CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_RELEASE_SHA256:bound.release.digest,CONTEXT_REFRESH_RECEIPT:JSON.stringify(bound.receipt),CONTEXT_REFRESH_GRANT:JSON.stringify(bound.grant)};
  assert.deepEqual(await loadRuntimeSnapshot(env,NOW), bound.snapshot);
  await assert.rejects(loadRuntimeSnapshot(env,NOW+600000), /expired/);
});
test('authorization cannot extend source freshness', async () => {
  const input = await setup();input.authorization.expires_at = new Date(NOW+7200000).toISOString();input.anchor.authorization_digest=await sha256(input.authorization);
  assert.equal((await bindReviewedRefresh(input)).snapshot.expires_at, input.candidate.expires_at);
});
test('cutoff, changed scope, destination, sources and review fail closed', async () => {
  for (const change of [
    x=>x.now=NOW+600000,
    x=>x.authorization.approved_at=new Date(NOW+1).toISOString(),
    x=>x.authorization.scope='anything',
    x=>x.siteProjectId='appgprj_other',
    x=>x.savedVersionId='appgprj_other~appgver_existing',
    x=>x.authorization.sources=['claude:replies'],
    x=>x.authorization.constraints.pop(),
    x=>x.review.candidate_digest='0'.repeat(64),
    x=>x.review.reviewed_at=new Date(NOW-1).toISOString(),
    x=>x.review.reviewed_by='automatic',
    x=>x.candidate.items[0].context='Unreviewed change',
  ]) {
    const input=await setup();change(input);await assert.rejects(bindReviewedRefresh(input));
  }
});
test('candidate already expired or already classified reviewed is refused', async () => {
  const input=await setup();input.authorization.expires_at=new Date(NOW+7200000).toISOString();input.now=NOW+7200000;
  await assert.rejects(bindReviewedRefresh(input));
  const fresh=await setup(),bound=await bindReviewedRefresh(fresh);fresh.candidate=bound.snapshot;
  await assert.rejects(bindReviewedRefresh(fresh),/pending_review_required/);
});

function runtime(bound) {return {...snapshotBindings(bound.release.payload),CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_RELEASE_SHA256:bound.release.digest,CONTEXT_REFRESH_RECEIPT:JSON.stringify(bound.receipt),CONTEXT_REFRESH_GRANT:JSON.stringify(bound.grant)};}
test('runtime validates the derived chain and rejects edited receipts or mixed approval modes', async()=> {
 const b=await bindReviewedRefresh(await setup());
 for(const change of [
  x=>x.receipt.authorized_at=x.receipt.bound_at,
  x=>x.receipt.authorization_digest='0'.repeat(64),
  x=>x.receipt.candidate_digest='0'.repeat(64),
  x=>x.receipt.saved_version_id='appgprj_example~appgver_other',
  x=>x.receipt.release_digest='0'.repeat(64),
  x=>x.grant.authorization.expires_at=new Date(NOW+7200000).toISOString(),
 ]) {const copy=structuredClone(b);change(copy);await assert.rejects(loadRuntimeSnapshot(runtime(copy),NOW));}
 await assert.rejects(loadRuntimeSnapshot({...runtime(b),CONTEXT_APPROVAL_RECEIPT:'{}'},NOW),/mixed_approval_modes/);
 await assert.rejects(loadRuntimeSnapshot({...runtime(b),CONTEXT_REFRESH_GRANT:''},NOW),/refresh_authorization_required/);
});
test('missing expected feeds, different saved version and changed execution scope are refused',async()=>{
 const missing=await setup();missing.authorization.sources.push('claude:replies');missing.anchor.authorization_digest=await sha256(missing.authorization);
 await assert.rejects(bindReviewedRefresh(missing),/refresh_source_not_authorized/);
 const version=await setup();version.savedVersionId='appgprj_example~appgver_unreviewed';
 await assert.rejects(bindReviewedRefresh(version),/refresh_destination_mismatch/);
 for(const field of ['credential_exception_consumed','automatic_refresh_installed']) {
  const x=await setup();x.authorization[field]=!x.authorization[field];x.anchor.authorization_digest=await sha256(x.authorization);
  await assert.rejects(bindReviewedRefresh(x),/refresh_execution_scope_changed/);
 }
});
