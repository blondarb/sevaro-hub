import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assemble,sha256,validateFeed,resolveReference} from '../context.mjs';
import {LINK_HOSTS,validateSnapshot,loadRuntimeSnapshot} from '../release.mjs';
import {emptyRetention,rememberPublication,carryAttention,disposeAttention,validateRetention} from '../attention-retention.mjs';
import {refreshOnce,updateRetainedAttention} from '../refresh.mjs';
import {retainPublishedReview} from '../retain-publication.mjs';
import {collectSources} from '../collector.mjs';
import {CLAUDE_EXPORT_POLICY} from '../claude-export.mjs';
import worker from '../../command-center-proof/worker.mjs';
import {collectAsana} from '../adapters.mjs';
import {row,source,entry,NOW} from './fixtures.mjs';
const ID='claude:replies:cedar';
const item=()=>row({item_id:ID,source_id:'claude:replies',source_url:'https://outlook.office.com/mail/id/cedar',kind:'response',action_state:'proposed'});
const feed=(overrides={})=>source({source_id:'claude:replies',system:'claude',items:[item()],...overrides});
const plan={schema_version:1,sources:[{source_id:'claude:replies',system:'claude',private_export_path:'/private/replies.json',allowed_hosts:LINK_HOSTS}]};
const options={expectedSources:['claude:replies'],allowedHosts:LINK_HOSTS,now:NOW,classification:'executive-reviewed'};
async function seed() {
  const snapshot=await assemble([feed()],options);
  const publication={id:'deployment:synthetic',published_at:new Date(NOW+1).toISOString(),snapshot_digest:await sha256(snapshot)};
  const store=await rememberPublication({store:await emptyRetention(),snapshot,publication,verifyPublication:async()=>true,now:NOW+1});
  return {snapshot,publication,store};
}
async function pending(feeds,now=NOW+7200_000){return assemble(feeds,{...options,classification:'executive-pending-review',now});}
async function sealed(s){const {snapshot_id,view_id,...body}=s;const h=await sha256(body);return {...body,snapshot_id:'snapshot-'+h,view_id:'today-'+h};}

test('only verified published review seeds history; replay is idempotent',async()=>{
  const {snapshot,publication,store}=await seed();
  assert.deepEqual(await rememberPublication({store,snapshot,publication,verifyPublication:async()=>true,now:NOW+2}),store);
  for(const classify of ['synthetic-only','executive-pending-review']) {
    const s=await sealed({...snapshot,classification:classify});
    await assert.rejects(rememberPublication({store,snapshot:s,publication:{...publication,snapshot_digest:await sha256(s)},verifyPublication:async()=>true,now:NOW+2}),/published_review_required/);
  }
  await assert.rejects(rememberPublication({store,snapshot,publication,now:NOW+2}),/verified_publication_required/);
  await assert.rejects(rememberPublication({store,snapshot,publication,verifyPublication:async()=>false,now:NOW+2}),/verified_publication_required/);
});
test('expiry and repeated empty exports retain the exact historical obligation',async()=>{
  const {store}=await seed();const later=NOW+7200_000;
  const p=await carryAttention(await pending([feed()]),store,{now:later});
  assert.equal(p.items.length,1);assert.equal(p.health[0].state,'stale');assert.equal(p.items[0].retention.source_observed_at,feed().observed_at);
  assert.equal(p.items[0].status,item().status);assert.equal(p.items[0].source_revision,item().source_revision);assert.equal(p.items[0].action_state,'none');
  for(const status of ['available','partial']) {
    const f=feed({status,items:[],observed_at:new Date(later).toISOString(),expires_at:new Date(later+3600_000).toISOString()});
    const next=await carryAttention(await pending([f]),store,{now:later});assert.equal(next.items[0].item_id,ID);assert.equal(next.today_item_ids[0],ID);
  }
  const pins={snapshot_id:p.snapshot_id,view_id:p.view_id};assert.deepEqual(resolveReference(p,pins,'tell me about number one',later).item,p.items[0]);
});
test('a fresh source record supersedes history without changing its identity',async()=>{
  const {store}=await seed(),later=NOW+7200_000;
  const f=feed({observed_at:new Date(later).toISOString(),expires_at:new Date(later+3600_000).toISOString(),items:[{...item(),source_revision:'fresh-revision',context:'Fictional revised request.'}]});
  const p=await carryAttention(await pending([f]),store,{now:later});assert.equal(p.items.length,1);assert.equal(p.items[0].source_revision,'fresh-revision');assert.equal(p.items[0].retention,undefined);
});
test('removed, excluded and permission-denied sources cannot reappear through history',async()=>{
  const {store}=await seed(),later=NOW+7200_000;
  const other=await assemble([source()],{...options,expectedSources:['asana:portfolio'],classification:'executive-pending-review',now:later});
  assert.equal((await carryAttention(other,store,{now:later})).items.length,0);
  assert.equal((await carryAttention(await pending([feed()]),store,{allowedItem:()=>false,now:later})).items.length,0);
  for(const code of ['permission_required','source_conflict']) {
    const p=await carryAttention(await pending([feed({status:'unavailable',failure_code:code,items:[]})]),store,{now:later});assert.equal(p.items.length,0);
  }
});
test('exact verified disposition removes attention; omission and replay never do',async()=>{
  const {store,snapshot,publication}=await seed();
  const args={store,itemId:ID,decision:'dismissed',itemDigest:await sha256(item()),evidenceId:'owner-instruction:synthetic',decidedAt:new Date(NOW+100).toISOString(),now:NOW+100};
  await assert.rejects(disposeAttention(args),/verified_disposition_required/);
  await assert.rejects(disposeAttention({...args,itemDigest:'0'.repeat(64),verifyDisposition:async()=>true}),/disposition_item_changed/);
  const done=await disposeAttention({...args,verifyDisposition:async()=>true});
  assert.deepEqual(await disposeAttention({...args,store:done}),done);
  const replay=await rememberPublication({store:done,snapshot,publication,verifyPublication:async()=>true,now:NOW+100});assert.equal(replay.entries[0].state,'dismissed');
  assert.equal((await carryAttention(await pending([feed()]),done,{now:NOW+7200_000})).items.length,0);
});
test('tampering, producer-supplied retention and historical action state fail closed',async()=>{
  const {store}=await seed(),bad=structuredClone(store);bad.entries[0].item.context='Changed';await assert.rejects(validateRetention(bad),/retention_digest_mismatch/);
  assert.throws(()=>validateFeed(feed({items:[{...item(),retention:{}}]}),LINK_HOSTS,NOW));
  const p=await carryAttention(await pending([feed()]),store,{now:NOW+7200_000});p.items[0].action_state='proposed';await assert.rejects(validateSnapshot(await sealed(p),NOW+7200_000),/historical_action_forbidden/);
});
test('saved attention survives refreshes and process reload without seeding pending items',async()=>{
  const root=await mkdtemp(join(tmpdir(),'attention-retention-'));await chmod(root,0o700);const {store}=await seed();
  await updateRetainedAttention({root,update:async()=>store});
  const collect=async()=>({expected_sources:['claude:replies'],feeds:[feed()]});
  for(const now of [NOW+7200_000,NOW+10800_000]) {
    assert.equal((await refreshOnce({root,plan,collect,now})).ok,true);
    const p=JSON.parse(await readFile(join(root,'proposed-current-context.json')));assert.equal(p.items[0].item_id,ID);assert.ok(p.items[0].retention);
  }
  assert.equal((await lstat(join(root,'retained-attention.json'))).mode&0o777,0o600);
  const blank=await mkdtemp(join(tmpdir(),'attention-pending-'));await chmod(blank,0o700);
  await refreshOnce({root:blank,plan,collect,now:NOW});
  assert.equal(await lstat(join(blank,'retained-attention.json')).then(()=>true,()=>false),false);
  assert.equal((await refreshOnce({root:blank,plan,collect,now:NOW+7200_000})).ok,false);
});
test('corrupt retention prevents replacement rather than silently discarding history',async()=>{
  const root=await mkdtemp(join(tmpdir(),'attention-corrupt-'));await chmod(root,0o700);await writeFile(join(root,'retained-attention.json'),'{}',{mode:0o600});
  const r=await refreshOnce({root,plan,collect:async()=>({expected_sources:['claude:replies'],feeds:[feed()]}),now:NOW});assert.equal(r.ok,false);
  assert.equal(await readFile(join(root,'retained-attention.json'),'utf8'),'{}');
});
test('retention never extends snapshot access or exact approval expiry',async()=>{
  const {store}=await seed(),later=NOW+7200_000;let p=await carryAttention(await pending([feed()]),store,{now:later});p=await sealed({...p,classification:'executive-reviewed'});
  const digest=await sha256(p),env={CONTEXT_SNAPSHOT:JSON.stringify(p),CONTEXT_RELEASE_SHA256:digest,CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_APPROVAL_RECEIPT:JSON.stringify({digest,approved_by:'Steve',approved_at:new Date(later).toISOString(),expires_at:p.expires_at,scope:'owner-only-read-only-site'})};
  assert.equal((await loadRuntimeSnapshot(env,later)).items.length,1);
  await assert.rejects(loadRuntimeSnapshot(env,Date.parse(p.expires_at)),/snapshot_expired/);
});

test('source access denial persists across later outages until newer reviewed publication',async()=>{
  const root=await mkdtemp(join(tmpdir(),'attention-denial-'));await chmod(root,0o700);const {store}=await seed();
  await updateRetainedAttention({root,update:async()=>store});
  const later=NOW+7200_000;
  for(const [index,code] of ['permission_required','source_unavailable'].entries()) {
    await refreshOnce({root,plan,collect:async()=>({expected_sources:['claude:replies'],feeds:[feed({status:'unavailable',failure_code:code,items:[]})]}),now:later+index});
    const saved=JSON.parse(await readFile(join(root,'retained-attention.json')));
    assert.equal(saved.entries[0].state,'withheld');
    assert.equal((await carryAttention(await pending([feed()],later+index),saved,{now:later+index})).items.length,0);
  }
  const saved=JSON.parse(await readFile(join(root,'retained-attention.json'))),observed=later+10;
  const snapshot=await assemble([feed({observed_at:new Date(observed).toISOString(),expires_at:new Date(observed+3600_000).toISOString()})],{...options,now:observed});
  const publication={id:'deployment:reverified',published_at:new Date(observed+1).toISOString(),snapshot_digest:await sha256(snapshot)};
  const restored=await rememberPublication({store:saved,snapshot,publication,verifyPublication:async()=>true,now:observed+1});
  assert.equal(restored.entries[0].state,'active');
});

test('live Asana completion and excluded ownership remove saved attention across later outages',async()=>{
  for(const reason of ['resolved','excluded']) {
    const root=await mkdtemp(join(tmpdir(),'attention-asana-'));await chmod(root,0o700);
    const snapshot=await assemble([source()],{...options,expectedSources:['asana:portfolio']});
    const store=await rememberPublication({store:await emptyRetention(),snapshot,publication:{id:'deployment:asana',published_at:new Date(NOW+1).toISOString(),snapshot_digest:await sha256(snapshot)},verifyPublication:async()=>true,now:NOW+1});
    await updateRetainedAttention({root,update:async()=>store});
    const later=NOW+10_000,events=[];
    const f=await collectAsana({sourceId:'asana:portfolio',projectId:'100',entries:[entry()],stageLabels:{'5':'Validate'},excludedAssigneeGids:['8'],credential:'synthetic',now:new Date(later).toISOString(),onItemExcluded:e=>events.push(e),fetcher:async()=>Response.json({data:{gid:'101',modified_at:new Date(later).toISOString(),completed:reason==='resolved',due_on:null,due_at:null,assignee:{gid:reason==='excluded'?'8':'9'},memberships:[{project:{gid:'100'},section:{gid:'5'}}]}})});
    assert.equal(events.length,1);assert.equal(events[0].reason,reason);
    const asanaPlan={schema_version:1,sources:[{source_id:'asana:portfolio',system:'asana',entries:[entry()]}]};
    assert.equal((await refreshOnce({root,plan:asanaPlan,collect:async()=>({expected_sources:['asana:portfolio'],feeds:[f],attention_dispositions:events}),now:later})).ok,true);
    const saved=JSON.parse(await readFile(join(root,'retained-attention.json')));assert.equal(saved.entries[0].state,reason);
    const p=await assemble([source()],{...options,expectedSources:['asana:portfolio'],now:NOW+7200_000,classification:'executive-pending-review'});
    assert.equal((await carryAttention(p,saved,{now:NOW+7200_000})).items.length,0);
  }
});
test('owner-only page context and conversational resolve return identical retained item',async()=>{
  const {store}=await seed(),later=NOW+7200_000;
  const snapshot=await sealed({...await carryAttention(await pending([feed()]),store,{now:later}),classification:'executive-reviewed'});
  const digest=await sha256(snapshot),env={PROOF_OWNER_SITE_USER_ID:'owner',CONTEXT_SOURCE_MODE:'runtime',CONTEXT_SNAPSHOT:JSON.stringify(snapshot),CONTEXT_RELEASE_SHA256:digest,CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_APPROVAL_RECEIPT:JSON.stringify({digest,approved_by:'Steve',approved_at:new Date(later).toISOString(),expires_at:snapshot.expires_at,scope:'owner-only-read-only-site'})};
  const clock=mock.method(Date,'now',()=>later);
  try {
    const pins=new URLSearchParams({snapshot_id:snapshot.snapshot_id,view_id:snapshot.view_id});
    const request=(path,viewer='owner')=>new Request('https://proof.example'+path,{headers:viewer?{'oai-authenticated-user-id':viewer}:{}});
    const read=await worker.fetch(request('/api/context?'+pins),env);assert.equal(read.status,200);
    const context=await read.json(),resolved=await worker.fetch(request('/api/resolve?'+pins+'&item_number=1'),env);assert.equal(resolved.status,200);
    const result=await resolved.json();assert.deepEqual(context.items[0],result.item);assert.equal(result.item.action_state,'none');assert.equal(result.source_health.state,'stale');
    assert.equal((await worker.fetch(request('/api/context?'+pins,'other'),env)).status,403);
    assert.equal((await worker.fetch(request('/api/context?'+pins,''),env)).status,401);
  } finally {clock.mock.restore();}
});

test('new authoritative revision can reopen disposed attention; unchanged replay cannot',async()=>{
  const {store}=await seed();
  for(const decision of ['dismissed','resolved','excluded']) {
    const done=await disposeAttention({store,itemId:ID,decision,itemDigest:await sha256(item()),evidenceId:'verified:synthetic',decidedAt:new Date(NOW+10).toISOString(),verifyDisposition:async()=>true,now:NOW+10});
    const later=NOW+7200_000;
    const make=revision=>feed({observed_at:new Date(later).toISOString(),expires_at:new Date(later+3600_000).toISOString(),items:[{...item(),source_revision:revision}]});
    assert.equal((await carryAttention(await pending([make(item().source_revision)]),done,{now:later})).items.length,0);
    const snapshot=await carryAttention(await assemble([make('reopened-revision')],{...options,now:later}),done,{now:later});assert.equal(snapshot.items.length,1);assert.equal(snapshot.items[0].retention,undefined);
    const updated=await rememberPublication({store:done,snapshot,publication:{id:'deployment:reopened',published_at:new Date(later+1).toISOString(),snapshot_digest:await sha256(snapshot)},verifyPublication:async()=>true,now:later+1});
    assert.equal(updated.entries[0].state,'active');
  }
});
test('post-publication hook binds verified deployment and exact authenticated readback',async()=>{
  const root=await mkdtemp(join(tmpdir(),'attention-publication-'));await chmod(root,0o700);const {snapshot,publication}=await seed();
  const deployment={id:publication.id,project_id:'site:synthetic',version_id:'version:synthetic',type:'publish',status:'succeeded'};
  const args={root,snapshot,publication,expectedProjectId:'site:synthetic',expectedVersionId:'version:synthetic',readDeployment:async()=>deployment,readPublishedContext:async()=>snapshot,now:NOW+2};
  await assert.rejects(retainPublishedReview({...args,readDeployment:async()=>({...deployment,status:'failed'})}),/verified_publication_required/);
  await assert.rejects(retainPublishedReview({...args,readPublishedContext:async()=>({...snapshot,items:[]})}),/publication_readback_mismatch/);
  assert.equal((await retainPublishedReview(args)).entries,1);
  assert.equal((await retainPublishedReview(args)).entries,1);
});
test('direct malformed or mismatched Claude export persists a source conflict, not an ordinary outage',async()=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'attention-source-conflict-')));await chmod(root,0o700);
  const path=join(root,'source.json'),feedValue=feed();
  const run={run_id:'synthetic:run',routine:'synthetic',started_at:feedValue.observed_at,completed_at:new Date(NOW).toISOString(),outcome:'partial',coverage:'reviewed-sources-only'};
  const packet={schema_version:2,feed:feedValue,run,review:{reviewed_by:'Claude',reviewed_at:new Date(NOW).toISOString(),policy:CLAUDE_EXPORT_POLICY,feed_digest:await sha256(feedValue),packet_digest:await sha256({feed:feedValue,run})}};
  const p={schema_version:1,sources:[{...plan.sources[0],private_export_path:path}]};
  for(const content of ['{invalid',JSON.stringify({...packet,review:{...packet.review,feed_digest:'0'.repeat(64)}})]) {
    await writeFile(path,content,{mode:0o600});const result=await collectSources(p);
    assert.equal(result.feeds[0].failure_code,'source_conflict');
  }
  await writeFile(path,JSON.stringify(packet),{mode:0o600});
  const result=await collectSources({schema_version:1,sources:[{...p.sources[0],source_id:'claude:other'}]});assert.equal(result.feeds[0].failure_code,'source_conflict');
});
