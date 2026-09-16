import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {assemble,sha256} from '../context.mjs';
import {bindReviewedRefresh} from '../refresh-authorization.mjs';
import {loadHistoricalRuntimeSnapshot,loadRuntimeSnapshot,snapshotBindings} from '../release.mjs';
import worker from '../../command-center-proof/worker.mjs';
import {NOW,row,source} from './fixtures.mjs';

const at=n=>new Date(NOW+n).toISOString();
async function setup(){
  const authorization={schema_version:1,approved_by:'Steve',approved_at:at(-1000),expires_at:at(7200000),site_project_id:'appgprj_example',scope:'reviewed-executive-metadata-owner-only-read-only-refresh',sources:['asana:portfolio'],constraints:['no PHI, raw bodies or transcripts','preserve source observation and expiry','review content before each release','exact snapshot digest and expiry bound receipt per release','no source writes, sends, assignments, stage decisions or automatic merge','owner-only audience unchanged'],remaining_access_limits:['synthetic acceptance'],credential_exception:'spent',automatic_refresh_installed:false,credential_exception_consumed:true,refresh_mechanism:'Existing task',automatic_refresh_note:'No unattended publication'};
  const project=row({item_id:'asana:portfolio:100',kind:'project',spoken_name:'Cedar project',status:'Explore',requires_steve:false,action_state:'none'});
  const candidate=await assemble([source({items:[row(),project]})],{expectedSources:['asana:portfolio'],allowedHosts:['app.asana.com'],classification:'executive-pending-review',now:NOW,ttlMs:7200000,includePortfolio:true});
  const input={authorization,anchor:{authorization_digest:await sha256(authorization),site_project_id:'appgprj_example',saved_version_id:'appgprj_example~appgver_existing'},candidate,review:{candidate_digest:await sha256(candidate),reviewed_by:'Codex',reviewed_at:at(0),policy:'executive-project-context-v1'},siteProjectId:'appgprj_example',savedVersionId:'appgprj_example~appgver_existing',now:NOW};
  const bound=await bindReviewedRefresh(input);
  const env={...snapshotBindings(bound.release.payload),CONTEXT_SOURCE_MODE:'runtime',CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_RELEASE_SHA256:bound.release.digest,CONTEXT_REFRESH_RECEIPT:JSON.stringify(bound.receipt),CONTEXT_REFRESH_GRANT:JSON.stringify(bound.grant),PROOF_OWNER_SITE_USER_ID:'owner'};
  return {bound,env};
}

test('only published Today rows remain readable as old history, without action state',async()=>{
  const {bound,env}=await setup(),later=Date.parse(bound.snapshot.expires_at)+1000;
  await assert.rejects(loadRuntimeSnapshot(env,later),/snapshot_expired/);
  const old=await loadHistoricalRuntimeSnapshot(env,later);
  assert.equal(old.classification,'executive-historical');
  assert.equal(old.historical,true);
  assert.equal(old.items.length,1);
  assert.equal(old.items[0].item_id,'asana:portfolio:101');
  assert.equal(old.items[0].number,2); // Remains the number shown before expiry.
  assert.equal(old.items[0].action_state,'none');
  assert.equal(old.items[0].retention.state,'historical-needs-recheck');
  assert.equal(Date.parse(old.items[0].retention.source_observed_at),Date.parse(at(-60000)));
  assert.deepEqual(old.today_item_ids,['asana:portfolio:101']);
  assert.equal((await loadHistoricalRuntimeSnapshot(env,later)).snapshot_id,old.snapshot_id);
});

test('historical read still requires exact release, review chain, active owner grant and owner identity',async()=>{
  const {bound,env}=await setup(),later=Date.parse(bound.snapshot.expires_at)+1000;
  for(const altered of [
    {...env,CONTEXT_RELEASE_SHA256:'0'.repeat(64)},
    {...env,CONTEXT_REFRESH_RECEIPT:JSON.stringify({...bound.receipt,candidate_digest:'0'.repeat(64)})},
    {...env,CONTEXT_REAL_DATA_ENABLED:''},
    {...env,CONTEXT_APPROVAL_RECEIPT:'{}'},
  ]) await assert.rejects(loadHistoricalRuntimeSnapshot(altered,later));
  await assert.rejects(loadHistoricalRuntimeSnapshot(env,Date.parse(bound.grant.authorization.expires_at)),/refresh_authorization_expired/);
  mock.method(Date,'now',()=>later);
  try{
    const req=(viewer,path)=>new Request('https://proof.example'+path,{headers:viewer?{'oai-authenticated-user-id':viewer}:{}});
    assert.equal((await worker.fetch(req(null,'/'),env)).status,401);
    assert.equal((await worker.fetch(req('other','/'),env)).status,403);
    const page=await worker.fetch(req('owner','/'),env);
    assert.equal(page.status,200);
    assert.match(await page.text(),/history-/);
    const old=await loadHistoricalRuntimeSnapshot(env,later),params=new URLSearchParams({snapshot_id:old.snapshot_id,view_id:old.view_id});
    const read=await worker.fetch(req('owner','/api/context?'+params),env);
    assert.equal(read.status,200);
    assert.deepEqual(await read.json(),old);
    assert.equal((await worker.fetch(req('owner','/api/resolve?'+params+'&item_number=2'),env)).status,200);
    assert.equal((await worker.fetch(req('owner','/api/context?'+new URLSearchParams({snapshot_id:bound.snapshot.snapshot_id,view_id:bound.snapshot.view_id})),env)).status,409);
  }finally{mock.restoreAll();}
});
