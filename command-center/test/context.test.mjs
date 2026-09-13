import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { assemble, readSnapshot, resolveReference, sha256 } from '../context.mjs';
import { prepareRelease, loadRuntimeSnapshot, validateSnapshot, snapshotBindings } from '../release.mjs';
import worker from '../../command-center-proof/worker.mjs';
import { NOW, row, source, options } from './fixtures.mjs';
const pins = s => ({snapshot_id:s.snapshot_id,view_id:s.view_id});
const request = (path, who='owner', method='GET') => new Request('https://synthetic.example'+path,{method,headers:who?{'oai-authenticated-user-id':who}:{}});
test('protected transport chunks preserve exact approved Unicode snapshot and reject incomplete or mixed payloads',async()=>{
  const s=await assemble([source({items:Array.from({length:35},(_,i)=>row({item_id:'asana:portfolio:'+i,context:'Fictional 🧪 measurement review.'}))})],{...options,classification:'executive-reviewed'});
  const r=await prepareRelease(s,NOW), chunks=snapshotBindings(r.payload);
  assert.ok(Number(chunks.CONTEXT_SNAPSHOT_CHUNK_COUNT)>1);
  for(const [k,v] of Object.entries(chunks))if(k!=='CONTEXT_SNAPSHOT_CHUNK_COUNT')assert.ok(Buffer.byteLength(v)<=4096);
  const receipt={digest:r.digest,approved_by:'Steve',approved_at:s.generated_at,expires_at:s.expires_at,scope:'owner-only-read-only-site'};
  const env={...chunks,CONTEXT_RELEASE_SHA256:r.digest,CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_APPROVAL_RECEIPT:JSON.stringify(receipt)};
  assert.deepEqual(await loadRuntimeSnapshot(env,NOW),s);
  for(const change of [{CONTEXT_SNAPSHOT_CHUNK_0:undefined},{CONTEXT_SNAPSHOT_CHUNK_15:'extra'},{CONTEXT_SNAPSHOT_CHUNK_COUNT:'0'},{CONTEXT_SNAPSHOT_CHUNK_COUNT:'17'},{CONTEXT_SNAPSHOT:r.payload},{CONTEXT_SNAPSHOT_CHUNK_0:'x'.repeat(4097)}])await assert.rejects(loadRuntimeSnapshot({...env,...change},NOW),/context_unavailable/);
  await assert.rejects(loadRuntimeSnapshot({...env,CONTEXT_SNAPSHOT_CHUNK_0:env.CONTEXT_SNAPSHOT_CHUNK_0.replace('Fictional','Modified')},NOW),/digest_mismatch/);
  await assert.rejects(loadRuntimeSnapshot({...env,CONTEXT_APPROVAL_RECEIPT:undefined},NOW),/approval_required/);
  assert.throws(()=>snapshotBindings('x'.repeat(65537)),/release_too_large/);
});
test('partial chunk configuration without runtime mode cannot silently fall back to synthetic context',async()=>{
  const r=await worker.fetch(request('/api/status'),{PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SNAPSHOT_CHUNK_0:'partial'});
  assert.equal(r.status,409);
});
test('deduplication rejects conflicting records and source bundles rather than choosing status',async()=>{
  await assert.rejects(assemble([source(),source()],options),/duplicate_or_unexpected_source/);
  await assert.rejects(assemble([source({items:[row(),row({status:'Graduate'})]})],options),/duplicate_or_wrong_source/);
});
test('missing and expired sources are unavailable, not empty healthy feeds',async()=>{
  const s=await assemble([source({expires_at:'2026-09-13T20:00:00Z'})],options);
  assert.equal(s.items.length,0); assert.deepEqual(s.health.map(h=>h.state),['stale','unavailable']);
});

test('fresh partial coverage remains visible and expires out of the shared snapshot',async()=>{
 const partial=source({source_id:'claude:calendar',system:'claude',status:'partial',items:[row({item_id:'claude:calendar:prep',source_id:'claude:calendar',kind:'meeting',due:'2026-09-13T21:00:00Z'})]});
 const opts={...options,expectedSources:['claude:calendar']};
 const fresh=await assemble([partial],opts);
 assert.equal(fresh.health[0].state,'partial');assert.equal(fresh.health[0].failure_code,null);assert.equal(fresh.items.length,1);await validateSnapshot(fresh,NOW);
 const expired=await assemble([partial],{...opts,now:Date.parse(partial.expires_at)});
 assert.equal(expired.health[0].state,'stale');assert.equal(expired.items.length,0);await validateSnapshot(expired,Date.parse(partial.expires_at));
});

test('partial source state survives approved runtime retrieval and the page keeps its health notice',async()=>{
 const now=Date.now(),at=new Date(now).toISOString(),expires=new Date(now+60_000).toISOString();
 const partial=source({source_id:'claude:calendar',system:'claude',status:'partial',observed_at:at,expires_at:expires,items:[row({item_id:'claude:calendar:prep',source_id:'claude:calendar',kind:'meeting',due:expires})]});
 const snapshot=await assemble([partial],{...options,expectedSources:['claude:calendar'],now,classification:'executive-reviewed'}),release=await prepareRelease(snapshot,now);
 const approval={digest:release.digest,approved_by:'Steve',approved_at:at,expires_at:expires,scope:'owner-only-read-only-site'};
 const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'runtime',CONTEXT_SNAPSHOT:release.payload,CONTEXT_RELEASE_SHA256:release.digest,CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_APPROVAL_RECEIPT:JSON.stringify(approval),PROOF_BROWSER_SOURCE:'partial coverage'};
 const shared=await worker.fetch(request('/api/context?'+new URLSearchParams(pins(snapshot))),env);assert.equal(shared.status,200);assert.equal((await shared.json()).health[0].state,'partial');
 const page=await worker.fetch(request('/'),env);assert.match(await page.text(),/id="notice"/);
 assert.match(await readFile(new URL('../../command-center-proof/browser.mjs',import.meta.url),'utf8'),/Partial coverage:/);
 const pending=await assemble([partial],{...options,expectedSources:['claude:calendar'],now,classification:'executive-pending-review'}),pendingRelease=await prepareRelease(pending,now);
 await assert.rejects(loadRuntimeSnapshot({...env,CONTEXT_SNAPSHOT:pendingRelease.payload,CONTEXT_RELEASE_SHA256:pendingRelease.digest},now),/review_required/);
});
test('numbering is immutable and deterministic regardless of feed item order',async()=>{
  const a=row(),b=row({item_id:'asana:portfolio:102',spoken_name:'Harbor dependency',kind:'blocker'});
  const s=await assemble([source({items:[b,a]})],options),t=await assemble([source({items:[a,b]})],options);
  assert.equal(s.snapshot_id,t.snapshot_id); assert.equal(resolveReference(s,pins(s),'tell me about number two',NOW).item.spoken_name,'Harbor dependency');
  assert.throws(()=>s.items.reverse(),TypeError); assert.throws(()=>readSnapshot(s,{...pins(s),view_id:'other'},NOW),/snapshot_changed/);
  assert.throws(()=>readSnapshot(s,pins(s),Date.parse(s.expires_at)),/snapshot_expired/);
  for(const phrase of ['send it','approve number two','two or three'])assert.throws(()=>resolveReference(s,pins(s),phrase,NOW),/clarification_required/);
});
test('unknown raw fields, unsafe links, future observations and bad dates fail closed',async()=>{
  for(const bad of [row({email_body:'synthetic forbidden'}),row({source_url:'https://app.asana.com/0/100/101?token=synthetic'}),row({source_url:'https://evil.example/x'}),row({due:'2026-02-31'})])
    await assert.rejects(assemble([source({items:[bad]})],options));
  await assert.rejects(assemble([source({observed_at:'2026-09-14T20:00:00Z',expires_at:'2026-09-14T21:00:00Z'})],options),/invalid_freshness/);
});
test('routine portfolio and healthy agent activity stay off Today; waiting and failures remain visible',async()=>{
  const s=await assemble([source({items:[row({requires_steve:false,kind:'project'}),row({item_id:'asana:portfolio:102',kind:'waiting',requires_steve:false})]})],options);
  assert.deepEqual(s.today_item_ids,['asana:portfolio:102']);assert.equal(s.requiring_steve,0);
});
test('release binds exact digest, denies real data by default and caps payload size',async()=>{
  const s=await assemble([source()],options),r=await prepareRelease(s,NOW);
  assert.deepEqual(await loadRuntimeSnapshot({CONTEXT_SNAPSHOT:r.payload,CONTEXT_RELEASE_SHA256:r.digest},NOW),s);
  await assert.rejects(loadRuntimeSnapshot({CONTEXT_SNAPSHOT:r.payload,CONTEXT_RELEASE_SHA256:'bad'},NOW),/release_not_approved/);
  const real=await assemble([source()],{...options,classification:'executive-reviewed'}),rr=await prepareRelease(real,NOW);
  await assert.rejects(loadRuntimeSnapshot({CONTEXT_SNAPSHOT:rr.payload,CONTEXT_RELEASE_SHA256:rr.digest},NOW),/real_data_disabled/);
  const large=await assemble([source({items:Array.from({length:100},(_,i)=>row({item_id:'asana:portfolio:'+i,context:'x'.repeat(600),recommendation:'y'.repeat(400)}))})],options);
  await assert.rejects(prepareRelease(large,NOW),/release_too_large/);
});
test('tampered snapshot number, source health and body cannot be accepted',async()=>{
  const s=await assemble([source()],options);
  for(const alter of [v=>v.items[0].number=4,v=>v.items[0].context='changed',v=>v.health[0].state='stale',v=>v.raw_transcript='synthetic forbidden']){
    const copy=structuredClone(s);alter(copy);await assert.rejects(validateSnapshot(copy,NOW));
  }
});
test('runtime release pins reject old references, unknown input and write methods',async()=>{
  const now=Date.now(), at=new Date(now-1000).toISOString(), expires=new Date(now+60_000).toISOString();
  const a=await assemble([source({observed_at:at,expires_at:expires})],{...options,now}),r=await prepareRelease(a,now);
  const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'runtime',CONTEXT_SNAPSHOT:r.payload,CONTEXT_RELEASE_SHA256:r.digest};
  const path='/api/resolve?'+new URLSearchParams({...pins(a),item_number:'1'});
  const response=await worker.fetch(request(path),env);assert.equal(response.status,200);assert.equal((await response.json()).item.item_id,a.items[0].item_id);
  for(const p of ['/','/api/context','/api/resolve','/proof.js']){
    assert.equal((await worker.fetch(request(p,null),env)).status,401);
    assert.equal((await worker.fetch(request(p,'other'),env)).status,403);
  }
  for(const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await worker.fetch(request(path,'owner',method),env)).status,405);
  assert.equal((await worker.fetch(request(path+'&phrase=send'),env)).status,400);
  const b=await assemble([source({observed_at:at,expires_at:expires,items:[row({status:'Explore'})]})],{...options,now}),rb=await prepareRelease(b,now);
  assert.equal((await worker.fetch(request(path),{...env,CONTEXT_SNAPSHOT:rb.payload,CONTEXT_RELEASE_SHA256:rb.digest})).status,409);
});
test('quiet items never enter the released Today snapshot; rehashed view tampering fails',async()=>{
  const s=await assemble([source({items:[row(),row({item_id:'asana:portfolio:102',kind:'project',requires_steve:false})]})],options);
  assert.equal(s.items.length,1);
  for(const change of [v=>v.today_item_ids=[],v=>{v.items[0].requires_steve=false;v.items[0].kind='project';v.requiring_steve=0;}]){
    const copy=structuredClone(s);change(copy);const {snapshot_id,view_id,...body}=copy;const hash=await sha256(body);copy.snapshot_id='snapshot-'+hash;copy.view_id='today-'+hash;
    await assert.rejects(validateSnapshot(copy,NOW),/invalid_today_view/);
  }
});
test('pending data is never runtime-approved, and reviewed data needs a bound unexpired receipt',async()=>{
  const pending=await assemble([source()],{...options,classification:'executive-pending-review'}),pr=await prepareRelease(pending,NOW);
  await assert.rejects(loadRuntimeSnapshot({CONTEXT_SNAPSHOT:pr.payload,CONTEXT_RELEASE_SHA256:pr.digest,CONTEXT_REAL_DATA_ENABLED:'approved'},NOW),/review_required/);
  const reviewed=await assemble([source()],{...options,classification:'executive-reviewed'}),rr=await prepareRelease(reviewed,NOW);
  const env={CONTEXT_SNAPSHOT:rr.payload,CONTEXT_RELEASE_SHA256:rr.digest,CONTEXT_REAL_DATA_ENABLED:'approved'};
  await assert.rejects(loadRuntimeSnapshot(env,NOW),/approval_required/);
  const receipt={digest:rr.digest,approved_by:'Steve',approved_at:new Date(NOW).toISOString(),expires_at:reviewed.expires_at,scope:'owner-only-read-only-site'};
  assert.deepEqual(await loadRuntimeSnapshot({...env,CONTEXT_APPROVAL_RECEIPT:JSON.stringify(receipt)},NOW),reviewed);
  for(const change of [{digest:'different'},{approved_by:'automatic'},{expires_at:new Date(NOW).toISOString()}])
    await assert.rejects(loadRuntimeSnapshot({...env,CONTEXT_APPROVAL_RECEIPT:JSON.stringify({...receipt,...change})},NOW),/approval_/);
});
test('one hundred visible items resolve, but aggregate overflow and bidi text are rejected',async()=>{
  const items=Array.from({length:100},(_,i)=>row({item_id:'asana:portfolio:'+String(i).padStart(3,'0')}));
  const s=await assemble([source({items})],options);
  assert.equal(resolveReference(s,pins(s),'number 100',NOW).item.number,100);
  await assert.rejects(assemble([source({items}),source({source_id:'asana:second',items:[row({source_id:'asana:second',item_id:'asana:second:1'})]})],{...options,expectedSources:['asana:portfolio','asana:second']}),/too_many_items/);
  await assert.rejects(assemble([source({items:[row({context:'Hidden \u202e text'})]})],options),/invalid_text/);
});

test('removed setting representations restore the fixed proof; partial releases remain closed',async()=>{
  for(const empty of [undefined,null,'']) {
    const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SNAPSHOT:empty,CONTEXT_RELEASE_SHA256:empty};
    assert.equal((await worker.fetch(request('/'),env)).status,200);
  }
  for(const incomplete of [{CONTEXT_SNAPSHOT:'{}'},{CONTEXT_RELEASE_SHA256:'digest'}])
    assert.equal((await worker.fetch(request('/api/context'),{PROOF_OWNER_SITE_USER_ID:'owner',...incomplete})).status,409);
});

test('explicit synthetic mode never reads removed settings; runtime mode requires a complete release',async()=>{
  const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'synthetic'};
  for(const key of ['CONTEXT_SNAPSHOT','CONTEXT_RELEASE_SHA256'])Object.defineProperty(env,key,{get(){throw Error('missing setting');}});
  assert.equal((await worker.fetch(request('/'),env)).status,200);
  assert.equal((await worker.fetch(request('/api/context'),{PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'runtime'})).status,409);
});

test('unknown mode refuses even a complete approved executive release',async()=>{
  const now=Date.now(),at=new Date(now).toISOString(),expires=new Date(now+60_000).toISOString();
  const snapshot=await assemble([source({observed_at:at,expires_at:expires})],{...options,now,classification:'executive-reviewed'}),release=await prepareRelease(snapshot,now);
  const approval={digest:release.digest,approved_by:'Steve',approved_at:at,expires_at:expires,scope:'owner-only-read-only-site'};
  const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SNAPSHOT:release.payload,CONTEXT_RELEASE_SHA256:release.digest,CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_APPROVAL_RECEIPT:JSON.stringify(approval)};
  for(const mode of ['synthetci','',null,undefined])assert.equal((await worker.fetch(request('/api/context'),{...env,CONTEXT_SOURCE_MODE:mode})).status,409);
  assert.equal((await worker.fetch(request('/'),{...env,CONTEXT_SOURCE_MODE:'runtime'})).status,200);
});


test('expired approval preserves only authenticated empty shell, never released work',async()=>{
  const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'runtime',CONTEXT_SNAPSHOT:'invalid',PROOF_BROWSER_SOURCE:'// synthetic static script'};
  const shell=await worker.fetch(request('/'),env);assert.equal(shell.status,200);
  const html=await shell.text();assert.match(html,/Steve · Command Center/);assert.match(html,/content="unavailable"/);
  assert.equal((await worker.fetch(request('/api/context'),env)).status,409);
  assert.equal((await worker.fetch(request('/proof.js'),env)).status,200);
  assert.equal((await worker.fetch(request('/','other'),env)).status,403);
});

test('two-hour review must be freshly approved and does not renew old receipts',async()=>{
  const end=new Date(NOW+7200_000).toISOString();
  const s=await assemble([source({expires_at:end})],{...options,ttlMs:7200_000,classification:'executive-reviewed'});
  const r=await prepareRelease(s,NOW);
  const receipt={digest:r.digest,approved_by:'Steve',approved_at:new Date(NOW).toISOString(),expires_at:end,scope:'owner-only-read-only-site'};
  const env={CONTEXT_SNAPSHOT:r.payload,CONTEXT_RELEASE_SHA256:r.digest,CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_APPROVAL_RECEIPT:JSON.stringify(receipt)};
  assert.deepEqual(await loadRuntimeSnapshot(env,NOW+7199_000),s);
  await assert.rejects(loadRuntimeSnapshot(env,NOW+7200_000),/snapshot_expired/);
  await assert.rejects(loadRuntimeSnapshot({...env,CONTEXT_APPROVAL_RECEIPT:JSON.stringify({...receipt,expires_at:new Date(NOW+60_000).toISOString()})},NOW+61_000),/approval_expired/);
  await assert.rejects(assemble([source({expires_at:new Date(NOW+7201_000).toISOString()})],{...options,ttlMs:7201_000}));
});


test('explicit portfolio review shares one approved snapshot while Today stays exception-only',async()=>{
 const visible=row(),quiet=row({item_id:'asana:portfolio:102',kind:'project',requires_steve:false});
 const s=await assemble([source({items:[quiet,visible]})],{...options,includePortfolio:true});
 assert.equal(s.items.length,2);assert.deepEqual(s.today_item_ids,[visible.item_id]);
 assert.equal(resolveReference(s,pins(s),'number two',NOW).item.item_id,quiet.item_id);
 await validateSnapshot(s,NOW);
 const copy=structuredClone(s);copy.today_item_ids.push(quiet.item_id);
 const {snapshot_id,view_id,...body}=copy,hash=await sha256(body);copy.snapshot_id='snapshot-'+hash;copy.view_id='today-'+hash;
 await assert.rejects(validateSnapshot(copy,NOW),/invalid_today_view/);
});


test('health distinguishes verification failure from a ready shell without disclosing content',async()=>{
 const env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'runtime'};
 const root=await worker.fetch(request('/'),env);assert.equal(root.headers.get('X-Context-State'),'unavailable');
 const health=await worker.fetch(request('/api/status'),env);assert.equal(health.status,409);
 assert.deepEqual(await health.json(),{state:'unavailable',reason:'context_unavailable'});
 for(const who of [null,'other'])assert.equal((await worker.fetch(request('/api/status',who),env)).status,who?403:401);
});
