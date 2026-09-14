import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {database,synthetic} from './testing/synthetic.mjs';
import {sha256} from '../command-center/context.mjs';
import {ApprovalStore} from './approval-store.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const origin='https://proof.example';
function req(path,body,headers={}) {return new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{'oai-authenticated-user-id':'synthetic-owner',origin,'content-type':'application/json','x-command-approval':'exact-proposals-v1',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function call(env,path,body,headers) {const r=await worker.fetch(req(path,body,headers),env);return {status:r.status,...await r.json()};}
async function fixture() {
  const {catalog,env}=await synthetic();env.DB=await database();Object.assign(env,{DELIVERY_SUPERVISION_ENABLED:'true',CLAUDE_DELIVERY_READY:'true',ASANA_SINGLE_WRITER_READY:'true'});
  const p=catalog.proposals[0],choice={catalog_digest:env.APPROVAL_CATALOG_SHA256,decisions:[{proposal_digest:p.digest,decision:'approve',expected_revision:0}]};
  assert.equal((await call(env,'/api/approvals/decide',choice)).status,200);
  const claim={catalog_digest:env.APPROVAL_CATALOG_SHA256,proposal_digest:p.digest,approval_revision:1,expected_revision:0,supervisor_run_id:'synthetic-run-one'};
  return {env,p,claim};
}
async function startBody(p,claim,receipt) {return {...claim,supervisor_run_id:undefined,expected_revision:receipt.revision,attempt_id:receipt.attempt_id,preflight:{source_revision:p.source_revision,checked_at:new Date().toISOString(),destination_digest:await sha256({source_url:p.source_url,executor:p.executor,payload:p.payload})}};}
const outcome=(p,r,state='succeeded')=>({proposal_digest:p.digest,attempt_id:r.attempt_id,expected_revision:r.revision,state,provider_ref:state==='succeeded'?'fictional-provider-id':null,readback_digest:state==='succeeded'?'b'.repeat(64):null,reason_code:state==='succeeded'?null:'transport_uncertain'});
test('delivery routes require owner auth and same-origin bounded JSON; default disabled',async()=>{
  const {env,claim}=await fixture();
  for(const path of ['/api/delivery/history','/api/delivery/claim','/api/delivery/start','/api/delivery/outcome'])for(const owner of ['','other-owner'])assert.equal((await call(env,path,path.endsWith('history')?undefined:claim,{'oai-authenticated-user-id':owner})).status,owner?403:401);
  for(const header of [{origin:'https://other.example'},{'sec-fetch-site':'cross-site'},{'x-command-approval':''}])assert.equal((await call(env,'/api/delivery/claim',claim,header)).status,403);
  assert.equal((await call(env,'/api/delivery/claim',{...claim,padding:'x'.repeat(9000)})).status,413);
  env.DELIVERY_SUPERVISION_ENABLED='false';assert.equal((await call(env,'/api/delivery/claim',claim)).error,'delivery_supervision_disabled');
  env.DELIVERY_SUPERVISION_ENABLED='true';env.CLAUDE_DELIVERY_READY='false';assert.equal((await call(env,'/api/delivery/claim',claim)).error,'executor_not_ready');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM delivery_events').get().n,0);
});
test('one concurrent claim wins; retry same run is idempotent and another run cannot send',async()=>{
  const {env,claim}=await fixture();
  const rs=await Promise.all([call(env,'/api/delivery/claim',claim),call(env,'/api/delivery/claim',{...claim,supervisor_run_id:'other-run'})]);
  assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
  const winner=rs.find(r=>r.status===200).receipt;
  const retry=await call(env,'/api/delivery/claim',{...claim,supervisor_run_id:winner.supervisor_run_id});assert.equal(retry.receipt.attempt_id,winner.attempt_id);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM delivery_events').get().n,1);
});
test('expired reservation can be reclaimed; a started dispatch never can, even after its lease expires',async()=>{
  const {env,p,claim}=await fixture();const first=await call(env,'/api/delivery/claim',claim);
  env.DB.raw.prepare('UPDATE delivery_events SET lease_expires_at=?').run('2020-01-01T00:00:00Z');
  const second=await call(env,'/api/delivery/claim',{...claim,expected_revision:1,supervisor_run_id:'new-run'});assert.equal(second.status,200);assert.notEqual(first.receipt.attempt_id,second.receipt.attempt_id);
  const body=await startBody(p,claim,second.receipt),started=await call(env,'/api/delivery/start',body);assert.equal(started.status,200);
  assert.equal((await call(env,'/api/delivery/start',body)).error,'dispatch_already_started_or_changed');
  env.DB.raw.prepare('UPDATE delivery_events SET lease_expires_at=?').run('2020-01-01T00:00:00Z');
  assert.equal((await call(env,'/api/delivery/claim',{...claim,expected_revision:started.receipt.revision})).error,'delivery_already_reserved_or_dispatched');
});
test('current approval and exact fresh provider preflight required before dispatch',async()=>{
  const {env,p,claim}=await fixture();const c=await call(env,'/api/delivery/claim',claim),body=await startBody(p,claim,c.receipt);
  for(const preflight of [{...body.preflight,source_revision:'changed'},{...body.preflight,destination_digest:'0'.repeat(64)},{...body.preflight,checked_at:'2020-01-01T00:00:00Z'}])assert.equal((await call(env,'/api/delivery/start',{...body,preflight})).error,'provider_preflight_required');
  await call(env,'/api/approvals/revoke',{proposal_digest:p.digest,expected_revision:1});
  assert.equal((await call(env,'/api/delivery/start',body)).error,'current_approval_required');
  assert.equal((await call(env,'/api/delivery/history')).receipts[0].label,'Approval withdrawn — not dispatched');
});
test('SQLite rechecks revocation atomically even after API preflight read',async()=>{
  const {env,p,claim}=await fixture();const c=await call(env,'/api/delivery/claim',claim),body=await startBody(p,claim,c.receipt),base=env.DB;
  let revoked=false;
  env.DB={prepare(sql){const stmt=base.prepare(sql);return {bind(...args){const bound=stmt.bind(...args);return {...bound,async first(){if(sql.startsWith('INSERT INTO delivery_events')&&!revoked){revoked=true;await new ApprovalStore(base).revoke({digest:p.digest,owner:await sha256({site_owner:'synthetic-owner'}),expectedRevision:1,now:Date.now()});}return bound.first();}};}};}};
  assert.equal((await call(env,'/api/delivery/start',body)).error,'delivery_conflict_or_approval_changed');
  assert.equal(base.raw.prepare("SELECT COUNT(*) AS n FROM delivery_events WHERE state='dispatch_started'").get().n,0);
});
test('uncertain dispatch is held; late provider readback reconciles without replay or renewed consent',async()=>{
  const {env,p,claim}=await fixture();const c=await call(env,'/api/delivery/claim',claim),s=await call(env,'/api/delivery/start',await startBody(p,claim,c.receipt));
  const u=await call(env,'/api/delivery/outcome',outcome(p,s.receipt,'unknown'));assert.equal(u.status,200);
  await call(env,'/api/approvals/revoke',{proposal_digest:p.digest,expected_revision:1});
  env.APPROVAL_CATALOG='';env.DELIVERY_SUPERVISION_ENABLED='false';
  assert.match((await call(env,'/api/approvals/history')).receipts[0].state,/Withdrawal requested/);
  const completed=await call(env,'/api/delivery/outcome',outcome(p,u.receipt));assert.equal(completed.status,200);
  assert.equal((await call(env,'/api/delivery/outcome',outcome(p,u.receipt))).receipt.event_id,completed.receipt.event_id);
  assert.match((await call(env,'/api/approvals/history')).receipts[0].state,/Executor reported success/);
  const cols=env.DB.raw.prepare('PRAGMA table_info(delivery_events)').all().map(c=>c.name);assert.ok(!cols.some(c=>/body|payload|token|message/.test(c)));
  const r=await call({...env,PROOF_OWNER_SITE_USER_ID:'new-owner'},'/api/delivery/history',undefined,{'oai-authenticated-user-id':'new-owner'});assert.equal(r.receipts.length,0);
});
test('a success without dispatch or missing provider readback is rejected',async()=>{
  const {env,p,claim}=await fixture();const c=await call(env,'/api/delivery/claim',claim);
  assert.equal((await call(env,'/api/delivery/outcome',outcome(p,c.receipt))).error,'dispatch_not_started');
  const s=await call(env,'/api/delivery/start',await startBody(p,claim,c.receipt));
  assert.equal((await call(env,'/api/delivery/outcome',{...outcome(p,s.receipt),readback_digest:null})).status,409);
  assert.equal((await call(env,'/api/delivery/outcome',{...outcome(p,s.receipt),provider_ref:'raw\nresponse'})).status,409);
});
test('failed/stale outcome retry is idempotent but never reopens dispatch',async()=>{
  for(const state of ['failed_definitive','stale']) {
    const {env,p,claim}=await fixture(),c=await call(env,'/api/delivery/claim',claim);
    const body={...outcome(p,c.receipt,'unknown'),state,reason_code:state==='stale'?'source_changed':'executor_unavailable'};
    const first=await call(env,'/api/delivery/outcome',body);assert.equal(first.status,200);
    assert.equal((await call(env,'/api/delivery/outcome',body)).receipt.event_id,first.receipt.event_id);
    assert.equal((await call(env,'/api/delivery/claim',{...claim,expected_revision:first.receipt.revision})).status,409);
  }
});
test('history joins approval/delivery state without per-record database requests',async()=>{
  const {env,claim}=await fixture();await call(env,'/api/delivery/claim',claim);
  const db=env.DB;let queries=0;
  env.DB={prepare(sql){queries++;return db.prepare(sql);}};
  for(const path of ['/api/approvals/history','/api/delivery/history']) {
    queries=0;const r=await call(env,path);assert.equal(r.status,200);assert.equal(r.receipts.length,1);assert.equal(queries,1);
  }
});
test('withdrawal after an attempted failed delivery does not assert it never dispatched',async()=>{
  const {env,p,claim}=await fixture(),c=await call(env,'/api/delivery/claim',claim);
  const started=await call(env,'/api/delivery/start',await startBody(p,claim,c.receipt));
  const failed=await call(env,'/api/delivery/outcome',{...outcome(p,started.receipt,'unknown'),state:'failed_definitive',reason_code:'provider_rejected'});assert.equal(failed.status,200);
  const revoked=await call(env,'/api/approvals/revoke',{proposal_digest:p.digest,expected_revision:1});
  assert.match(revoked.state,/delivery failed/);assert.doesNotMatch(revoked.state,/not dispatched/);
});
test('actual browser withdrawal handler makes no false no-delivery assertion',async()=>{
  const script=await readFile(new URL('./approvals-browser.mjs',import.meta.url),'utf8');
  const handler=script.slice(script.indexOf('async function withdraw('),script.indexOf('async function record('));
  for(const state of ['Withdrawal requested — delivery may have started','Executor reported success — readback not independently verified']) {
    const output={textContent:''};
    const result=await runInNewContext(handler+'; withdraw("digest",1)',{busy:false,controls(){},async load(){},$(){return output;},async fetch(){return {ok:true,async json(){return {state};}};}});
    assert.equal(result.state,state);assert.match(output.textContent,/Check the delivery status/);assert.doesNotMatch(output.textContent,/No external action has run/);
  }
});
